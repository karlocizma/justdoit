'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as d3 from 'd3'
import s from './NoteGraph.module.css'

type RawNote = { id: string; title: string | null; content: string | null }
type Node = d3.SimulationNodeDatum & { id: string; title: string; links: number }
type Link = { source: string; target: string }

function buildGraph(notes: RawNote[]): { nodes: Node[]; links: Link[] } {
  const titleToId: Record<string, string> = {}
  for (const n of notes) {
    if (n.title) titleToId[n.title.toLowerCase()] = n.id
  }

  const linkSet = new Set<string>()
  const links: Link[] = []

  for (const n of notes) {
    const matches = n.content?.matchAll(/\[\[([^\]]+)\]\]/g) ?? []
    for (const m of matches) {
      const targetId = titleToId[m[1].toLowerCase()]
      if (targetId && targetId !== n.id) {
        const key = [n.id, targetId].sort().join('--')
        if (!linkSet.has(key)) {
          linkSet.add(key)
          links.push({ source: n.id, target: targetId })
        }
      }
    }
  }

  const linkedIds = new Set(links.flatMap(l => [l.source, l.target]))
  const linkCount: Record<string, number> = {}
  for (const l of links) {
    linkCount[l.source] = (linkCount[l.source] ?? 0) + 1
    linkCount[l.target] = (linkCount[l.target] ?? 0) + 1
  }

  const nodes: Node[] = notes
    .filter(n => linkedIds.has(n.id) || notes.length <= 50)
    .map(n => ({ id: n.id, title: n.title ?? 'Untitled', links: linkCount[n.id] ?? 0 }))

  return { nodes, links }
}

export function NoteGraph({ notes }: { notes: RawNote[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const router = useRouter()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string } | null>(null)
  const [showAll, setShowAll] = useState(false)

  const visibleNotes = showAll ? notes : notes.filter(n => {
    return notes.some(other => {
      if (other.id === n.id) return false
      const re = new RegExp(`\\[\\[${n.title?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`)
      return re.test(other.content ?? '')
    }) || (n.content?.includes('[[') ?? false)
  })

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const width = svg.clientWidth || 800
    const height = svg.clientHeight || 600

    d3.select(svg).selectAll('*').remove()

    const { nodes, links } = buildGraph(visibleNotes)

    if (nodes.length === 0) return

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link & { source: Node; target: Node }>(links as (Link & { source: Node; target: Node })[])
        .id(d => d.id).distance(80).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20))

    const g = d3.select(svg).append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', e => g.attr('transform', e.transform))

    d3.select(svg).call(zoom)

    const style = getComputedStyle(svg)
    const borderColor = style.getPropertyValue('--jd-border').trim() || '#333'
    const accentColor = style.getPropertyValue('--jd-accent').trim() || '#8b7cff'
    const surfaceColor = style.getPropertyValue('--jd-surface').trim() || '#1a1a2e'

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', borderColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => 5 + Math.min(d.links * 2, 12))
      .attr('fill', accentColor)
      .attr('fill-opacity', 0.8)
      .attr('stroke', surfaceColor)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill-opacity', 1)
        setTooltip({ x: event.clientX, y: event.clientY, title: d.title })
      })
      .on('mousemove', function(event) {
        setTooltip(t => t ? { ...t, x: event.clientX, y: event.clientY } : null)
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill-opacity', 0.8)
        setTooltip(null)
      })
      .on('click', (_, d) => router.push(`/notes/${d.id}`))

    const dragBehavior = d3.drag<SVGCircleElement, Node>()
      .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
      .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.call(dragBehavior as any)

    const labelColor = style.getPropertyValue('--jd-fg').trim() || '#ededed'

    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.title.length > 20 ? d.title.slice(0, 20) + '…' : d.title)
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .attr('dy', d => -(5 + Math.min(d.links * 2, 12)) - 5)
      .style('fill', labelColor)
      .style('stroke', 'var(--jd-surface)')
      .style('stroke-width', '3px')
      .style('paint-order', 'stroke fill')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    sim.on('tick', () => {
      link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('x1', d => ((d.source as any) as Node).x ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('y1', d => ((d.source as any) as Node).y ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('x2', d => ((d.target as any) as Node).x ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('y2', d => ((d.target as any) as Node).y ?? 0)
      node.attr('cx', d => d.x ?? 0).attr('cy', d => d.y ?? 0)
      label.attr('x', d => d.x ?? 0).attr('y', d => d.y ?? 0)
    })

    return () => { sim.stop() }
  }, [visibleNotes, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const { nodes: allNodes } = buildGraph(visibleNotes)
  const hasLinks = buildGraph(notes).links.length > 0

  return (
    <div className={s.root}>
      <div className={s.header}>
        <h1 className={s.title}>Note Graph</h1>
        <div className={s.controls}>
          <span className={s.meta}>{allNodes.length} notes · {buildGraph(visibleNotes).links.length} connections</span>
          {notes.length > visibleNotes.length && (
            <button className={s.toggleBtn} onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Show linked only' : `Show all (${notes.length})`}
            </button>
          )}
        </div>
      </div>
      {!hasLinks && notes.length < 2 ? (
        <div className={s.empty}>
          <p>Create notes with <code>[[Note Title]]</code> links to see them connected here.</p>
        </div>
      ) : (
        <div className={s.canvas}>
          <svg ref={svgRef} className={s.svg} />
        </div>
      )}
      {tooltip && (
        <div className={s.tooltip} style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          {tooltip.title}
        </div>
      )}
    </div>
  )
}
