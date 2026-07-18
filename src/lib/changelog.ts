export interface ChangelogEntry {
  sha: string
  title: string
  date: string
  url: string
}

// Default GitHub merge-commit format is "Merge pull request #N from owner/branch"
// followed by the PR title as the next line — surface the PR title when present,
// it reads far better as a changelog entry than the merge subject.
function commitTitle(message: string) {
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines[0]?.startsWith('Merge pull request') && lines[1]) return lines[1]
  return lines[0] || message
}

function fmtCommitDate(iso: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

interface GithubCommit {
  sha: string
  html_url: string
  commit: { message: string; author?: { date?: string }; committer?: { date?: string } }
}

export async function fetchChangelog(limit = 12): Promise<ChangelogEntry[]> {
  const r = await fetch(`https://api.github.com/repos/gonespral/my-tracker/commits?per_page=${limit}`)
  if (!r.ok) throw new Error('Failed to load changelog')
  const data = await r.json() as GithubCommit[]
  return data.map((c) => ({
    sha: c.sha.slice(0, 7),
    title: commitTitle(c.commit.message),
    date: fmtCommitDate(c.commit.author?.date || c.commit.committer?.date || ''),
    url: c.html_url,
  }))
}
