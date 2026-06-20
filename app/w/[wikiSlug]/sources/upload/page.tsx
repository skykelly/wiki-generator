import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import UploadForm from '@/components/UploadForm'

export default async function UploadPage({
  params,
}: {
  params: Promise<{ wikiSlug: string }>
}) {
  const { wikiSlug } = await params
  const session = await auth()
  if (!session) redirect(`/auth/signin?callbackUrl=/w/${wikiSlug}/sources/upload`)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">소스 추가</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          URL, 텍스트, 또는 파일로 소스를 추가합니다. AI가 자동으로 요약하고 관련 개념을 업데이트합니다.
        </p>
      </div>
      <UploadForm wikiId={`wiki_${wikiSlug}`} />
    </div>
  )
}
