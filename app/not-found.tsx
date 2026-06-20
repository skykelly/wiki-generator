import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-neutral-800 mb-4">404</p>
      <h1 className="text-xl font-semibold text-white mb-2">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-neutral-500 mb-8">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
      <div className="flex gap-3">
        <Link href="/" className="text-sm bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition-colors">
          플랫폼 홈
        </Link>
      </div>
    </div>
  )
}
