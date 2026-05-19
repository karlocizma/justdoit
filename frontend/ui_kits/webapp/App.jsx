/* global React */

// ------- mock data -------
const MOCK_LISTS = [
  { id: "personal", title: "Personal", color: "#8b7cff", openCount: 4 },
  { id: "work",     title: "Work",     color: "#48d1cc", openCount: 6 },
  { id: "reading",  title: "Reading",  color: "#f5a623", openCount: 2 },
];

const MOCK_NOTES = [
  { id: "n1", title: "Q3 launch retrospective", color: "#8b7cff", pinned: true, archived: false,
    preview: "Things that went well — fast iteration on the editor, RLS shipped without incident. Things to fix — onboarding still feels uneven for invited workspace members.",
    tags: [{name:"work", color:"#48d1cc"},{name:"retro", color:"#f5a623"}], timeAgo: "2h ago" },
  { id: "n2", title: "Reading list — May", color: "#f5a623", pinned: true, archived: false,
    preview: "1. A Philosophy of Software Design\n2. Don Norman — Living with Complexity\n3. The Timeless Way of Building",
    tags: [{name:"personal", color:"#8b7cff"}], timeAgo: "yesterday" },
  { id: "n3", title: "Trip — Lisbon", color: "#48d1cc", pinned: true, archived: false,
    preview: "Flights booked. Stay: Alfama, 3 nights. Tasca near the basilica. Tram 28 only worth it before 9am.",
    tags: [{name:"travel", color:"#48d1cc"}], timeAgo: "3 days ago" },
  { id: "n4", title: "Backend plan — Supabase + Trigger.dev", color: "#4caf89", pinned: true, archived: false,
    preview: "Use PostgREST for ~80% of the surface. Edge Functions only for aggregation and webhook bridges. RLS replaces all custom middleware.",
    tags: [{name:"work", color:"#48d1cc"},{name:"arch", color:"#4caf89"}], timeAgo: "1 week ago" },
  { id: "n5", title: "Untitled", color: null, pinned: false, archived: false,
    preview: "Quick capture — figure out how to make the digest email less noisy. Maybe collapse same-day reminders.",
    tags: [], timeAgo: "just now" },
  { id: "n6", title: "Apartment ideas", color: "#e05c8b", pinned: false, archived: false,
    preview: "Sage walls in the bedroom. Linen curtains. A real reading chair, not just \"the couch corner\".",
    tags: [{name:"personal", color:"#8b7cff"}], timeAgo: "5 days ago" },
  { id: "n7", title: "Old Q1 retro (archived)", color: "#7b82a8", pinned: false, archived: true,
    preview: "Outdated, but worth keeping around for the lessons on onboarding velocity.",
    tags: [{name:"work", color:"#48d1cc"}], timeAgo: "3 months ago" },
];

const MOCK_TASKS = {
  personal: [
    { id: "t1", title: "Renew passport",                                 priority: 3, due: "-3", recurring: false, done: false },
    { id: "t2", title: "Pick up the package from the post office",       priority: 1, due: "today", recurring: false, done: false },
    { id: "t3", title: "Plan weekend hike",                               priority: 0, due: "tomorrow", recurring: false, done: false },
    { id: "t4", title: "Call mum",                                        priority: 2, due: "today", recurring: true, done: false,
      notes: "Sunday catch-up. Ask about the garden." },
    { id: "t5", title: "Pay credit card statement",                       priority: 2, due: null, recurring: true, done: true },
  ],
  work: [
    { id: "tw1", title: "Review workspace invite UX",                     priority: 3, due: "today", recurring: false, done: false },
    { id: "tw2", title: "Reply to alice@ on RLS cascade behavior",        priority: 2, due: "tomorrow", recurring: false, done: false },
    { id: "tw3", title: "Draft the Q3 retro doc",                         priority: 2, due: "today", recurring: false, done: false },
    { id: "tw4", title: "Migrate seed.sql to include workspace fixtures", priority: 1, due: null, recurring: false, done: false },
    { id: "tw5", title: "Run the weekly digest manually for two users",   priority: 0, due: null, recurring: true, done: false },
    { id: "tw6", title: "Triage backlog",                                 priority: 0, due: null, recurring: true, done: false },
    { id: "tw7", title: "Push 00011_workspaces migration",                priority: 0, due: null, recurring: false, done: true },
    { id: "tw8", title: "Stand-up notes",                                 priority: 0, due: null, recurring: true, done: true },
  ],
  reading: [
    { id: "tr1", title: "Finish chapter 7 — A Philosophy of Software Design", priority: 0, due: "tomorrow", recurring: false, done: false },
    { id: "tr2", title: "Read the SQLite full-text-search paper",            priority: 0, due: null, recurring: false, done: false },
  ],
};

const MOCK_TRASH = [
  { id: "x1", type: "note", title: "Old shopping list",        deletedAgo: "2 days ago" },
  { id: "x2", type: "task", title: "Buy a new keyboard mat",   deletedAgo: "1 week ago" },
];

function allTasks(tasksByList) {
  return Object.values(tasksByList).flat();
}

const MOCK_PENDING_INVITES = [
  { id: "inv-1", workspaceId: "ws-new", workspaceName: "Design Team" },
];

const appStyles = {
  root: {
    height: "100vh", width: "100vw",
    display: "flex", background: "var(--jd-bg)", color: "var(--jd-fg)",
    overflow: "hidden",
  },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 },
  scroller: { flex: 1, overflowY: "auto", overflowX: "hidden" },
  inviteBanner: {
    background: "rgba(108,99,255,0.12)",
    borderBottom: "1px solid rgba(108,99,255,0.3)",
    padding: "10px 20px",
    display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
    fontSize: 13,
  },
  inviteIcon: { color: "var(--jd-accent)", display: "flex", flexShrink: 0 },
  inviteText: { flex: 1, color: "var(--jd-fg)" },
  inviteAccept: {
    background: "var(--jd-accent)", color: "#fff", border: "none",
    borderRadius: 6, padding: "5px 12px",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  inviteDecline: {
    background: "transparent", color: "var(--jd-fg-muted)", border: "none",
    padding: "5px 8px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
  },
};

function App() {
  const [signedIn, setSignedIn] = React.useState(false);
  const [view, setView] = React.useState("dashboard");
  const [settingsSection, setSettingsSection] = React.useState("profile");
  const [tasks, setTasks] = React.useState(MOCK_TASKS);
  const [notes, setNotes] = React.useState(MOCK_NOTES);
  const [trash, setTrash] = React.useState(MOCK_TRASH);
  const [lists, setLists] = React.useState(MOCK_LISTS);
  const [workspaces, setWorkspaces] = React.useState([
    { id: "personal-ws", name: "Personal",          initial: "AC" },
    { id: "team-carbon", name: "Team Carbon",       initial: "TC" },
    { id: "side-inc",    name: "Side Project Inc.", initial: "SP" },
  ]);
  const [activeWorkspace, setActiveWorkspace] = React.useState("personal-ws");
  const [openTask, setOpenTask] = React.useState(null);
  const [editingNoteId, setEditingNoteId] = React.useState(null);
  const [modal, setModal] = React.useState(null); // 'new-list' | 'new-workspace' | null
  const [pendingInvites, setPendingInvites] = React.useState(MOCK_PENDING_INVITES);
  const [searchQuery, setSearchQuery] = React.useState("");

  const user = { name: "Alice Carter", email: "alice@example.com", initial: "AC" };
  const workspace = workspaces.find((w) => w.id === activeWorkspace) || workspaces[0];

  const goSettings = (section) => {
    setSettingsSection(section || "profile");
    setView("settings");
  };

  const toggleTask = (task) => {
    const listId = Object.keys(tasks).find((l) => tasks[l].some((t) => t.id === task.id));
    if (!listId) return;
    setTasks({
      ...tasks,
      [listId]: tasks[listId].map((t) => t.id === task.id ? { ...t, done: !t.done } : t),
    });
  };

  const addTask = (listId, title) => {
    const newTask = { id: "new" + Date.now(), title, priority: 0, due: null, recurring: false, done: false };
    setTasks({ ...tasks, [listId]: [newTask, ...tasks[listId]] });
  };

  const createList = (list) => {
    setLists([...lists, list]);
    setTasks({ ...tasks, [list.id]: [] });
    setModal(null);
    setView("list:" + list.id);
  };

  const createWorkspace = (ws) => {
    setWorkspaces([...workspaces, ws]);
    setActiveWorkspace(ws.id);
    setModal(null);
  };

  const createNote = () => {
    const id = "n-new-" + Date.now();
    const newNote = {
      id, title: "", color: null, pinned: false, archived: false,
      preview: "", tags: [], timeAgo: "just now",
    };
    setNotes([newNote, ...notes]);
    setEditingNoteId(id);
    setView("editor");
  };

  const openNoteEditor = (note) => {
    setEditingNoteId(note.id);
    setView("editor");
  };

  const restoreTrash = (item) => {
    setTrash(trash.filter((t) => t.id !== item.id));
  };

  const acceptInvite = (inv) => {
    setPendingInvites(pendingInvites.filter((i) => i.id !== inv.id));
    setWorkspaces([...workspaces, { id: inv.workspaceId, name: inv.workspaceName, initial: inv.workspaceName.slice(0, 2).toUpperCase() }]);
  };

  const dismissInvite = (inv) => setPendingInvites(pendingInvites.filter((i) => i.id !== inv.id));

  if (!signedIn) return <AuthCard onSignIn={() => setSignedIn(true)} />;

  const listIdMatch = view.startsWith("list:") ? view.slice(5) : null;
  const currentList = listIdMatch ? lists.find((l) => l.id === listIdMatch) : null;
  const currentEditingNote = notes.find((n) => n.id === editingNoteId);

  return (
    <div style={appStyles.root}>
      <Sidebar
        active={view}
        onNavigate={setView}
        lists={lists}
        workspace={workspace}
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={setActiveWorkspace}
        user={user}
        onSignOut={() => setSignedIn(false)}
        onGoSettings={goSettings}
        onNewList={() => setModal("new-list")}
        onNewWorkspace={() => setModal("new-workspace")}
      />
      <main style={appStyles.main}>
        <TopBar
          user={user}
          syncState="connected"
          onGoSettings={goSettings}
          onNavigate={setView}
          onSignOut={() => setSignedIn(false)}
          onSearch={(q) => { setSearchQuery(q); setView("search"); }}
        />
        {pendingInvites.map((inv) => (
          <div key={inv.id} style={appStyles.inviteBanner}>
            <span style={appStyles.inviteIcon}><IconUsers size={16} /></span>
            <span style={appStyles.inviteText}>
              You've been invited to join <strong>{inv.workspaceName}</strong>
            </span>
            <button style={appStyles.inviteAccept} onClick={() => acceptInvite(inv)}>Accept</button>
            <button style={appStyles.inviteDecline} onClick={() => dismissInvite(inv)}>Decline</button>
          </div>
        ))}
        <div style={appStyles.scroller}>
          {view === "dashboard" && (
            <Dashboard
              notes={notes}
              tasks={allTasks(tasks)}
              onOpenNote={openNoteEditor}
              onToggleTask={toggleTask}
              onOpenTask={setOpenTask}
            />
          )}
          {view === "notes" && (
            <NotesView
              notes={notes}
              onOpenNote={openNoteEditor}
              onNewNote={createNote}
            />
          )}
          {view === "archive" && (
            <ArchiveView notes={notes} onOpenNote={openNoteEditor} />
          )}
          {view === "trash" && (
            <TrashView items={trash} onRestore={restoreTrash} />
          )}
          {view === "editor" && currentEditingNote && (
            <NoteEditor
              note={currentEditingNote}
              onBack={() => setView("notes")}
              onChange={() => {}}
            />
          )}
          {currentList && (
            <TasksView
              list={currentList}
              tasks={tasks[currentList.id] || []}
              onToggleTask={toggleTask}
              onOpenTask={setOpenTask}
              onAddTask={(title) => addTask(currentList.id, title)}
            />
          )}
          {view === "search" && (
            <SearchView
              query={searchQuery}
              onBack={() => setView("dashboard")}
              onOpenNote={openNoteEditor}
              onOpenTask={setOpenTask}
            />
          )}
          {view === "settings" && (
            <Settings user={user} initialSection={settingsSection} />
          )}
        </div>
      </main>

      {openTask && (
        <TaskDetailPanel
          task={openTask}
          onClose={() => setOpenTask(null)}
          onToggle={(t) => { toggleTask(t); setOpenTask({ ...t, done: !t.done }); }}
          onChange={() => {}}
        />
      )}

      {modal === "new-list" && (
        <NewListModal onClose={() => setModal(null)} onCreate={createList} />
      )}
      {modal === "new-workspace" && (
        <NewWorkspaceModal onClose={() => setModal(null)} onCreate={createWorkspace} />
      )}
    </div>
  );
}

window.App = App;
