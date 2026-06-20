import { auth } from '@/auth'
import { getChatSessions } from '@/lib/data'
import ChatInterface from '@/app/chat/ChatInterface'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const wikiId = `wiki_${wikiSlug}`
  const session = await auth()
  const sessions = session?.user?.email ? await getChatSessions(session.user.email, wikiId) : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-lg font-semibold text-white mb-4">Chat</h1>
      <ChatInterface initialSessions={sessions} wikiId={wikiId} />
    </div>
  )
}
