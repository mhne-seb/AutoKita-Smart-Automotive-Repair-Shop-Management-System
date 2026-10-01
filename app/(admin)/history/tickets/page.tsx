import { redirect } from 'next/navigation'

// The three separate history pages were merged into one Service History page.
export default function Page() {
  redirect('/history')
}
