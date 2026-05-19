import { AuthCard } from '@/components/auth/AuthCard'

export const metadata = { title: 'Set new password — JustDoIt' }

export default function ResetPasswordPage() {
  return <AuthCard initialMode="reset-password" />
}
