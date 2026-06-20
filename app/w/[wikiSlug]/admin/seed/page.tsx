import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getWikiBySlug } from '@/lib/data'
import SeedManager from './SeedManager'

export default async function SeedPage({ params }: { params: Promise<{ wikiSlug: string }> }) {
  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/w/${(await params).wikiSlug}/admin/seed`)

  const { wikiSlug } = await params
  const wiki = await getWikiBySlug(wikiSlug)
  if (!wiki) notFound()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/w/${wikiSlug}/admin`} className="text-neutral-500 hover:text-neutral-300 text-sm">
            ← 어드민
          </Link>
          <h1 className="mt-3 text-2xl font-bold">{wiki.title}</h1>
          <p className="mt-1 text-neutral-400 text-sm">위키 시드 생성 · 검토</p>
        </div>
        <SeedManager wiki={wiki} wikiSlug={wikiSlug} />
      </div>
    </div>
  )
}
