/**
 * parser.ts — Parse output from git commands into typed data structures
 */

// ---------------------------------------------------------------------------
// Status (git status --porcelain=v2)
// ---------------------------------------------------------------------------

export type FileStatus =
  | "modified"   // M
  | "added"      // A
  | "deleted"    // D
  | "renamed"    // R
  | "copied"     // C
  | "untracked"  // ?
  | "ignored"    // !
  | "unmerged"   // conflict

export interface StatusEntry {
  type: FileStatus
  path: string
  origPath?: string      // for renames/copies
  indexStatus: string    // X in XY (staged change)
  workTreeStatus: string // Y in XY (unstaged change)
  staged: boolean        // has staged changes
  unstaged: boolean      // has unstaged changes
}

/**
 * Parse `git status --porcelain=v2` output.
 * Format docs: https://git-scm.com/docs/git-status#_porcelain_format_version_2
 */
export function parseStatus(output: string): StatusEntry[] {
  const entries: StatusEntry[] = []
  const lines = output.split("\n").filter(Boolean)

  for (const line of lines) {
    if (line.startsWith("# ")) continue // header lines

    const marker = line[0]

    if (marker === "1") {
      // Ordinary changed entry: 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      const parts = line.split(" ")
      const xy = parts[1] ?? ".."
      const X = xy[0] ?? "."
      const Y = xy[1] ?? "."
      const path = parts.slice(8).join(" ")
      entries.push({
        type: inferType(X, Y),
        path,
        indexStatus: X,
        workTreeStatus: Y,
        staged: X !== "." && X !== "?",
        unstaged: Y !== "." && Y !== "?",
      })
    } else if (marker === "2") {
      // Renamed/copied: 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
      const parts = line.split(" ")
      const xy = parts[1] ?? ".."
      const X = xy[0] ?? "."
      const Y = xy[1] ?? "."
      const rest = parts.slice(9).join(" ")
      const [path, origPath] = rest.split("\t")
      entries.push({
        type: X === "R" || Y === "R" ? "renamed" : "copied",
        path: path ?? "",
        origPath,
        indexStatus: X,
        workTreeStatus: Y,
        staged: X !== "." && X !== "?",
        unstaged: Y !== "." && Y !== "?",
      })
    } else if (marker === "u") {
      // Unmerged (conflict)
      const parts = line.split(" ")
      const path = parts.slice(10).join(" ")
      entries.push({
        type: "unmerged",
        path,
        indexStatus: "U",
        workTreeStatus: "U",
        staged: false,
        unstaged: true,
      })
    } else if (marker === "?") {
      // Untracked
      const path = line.slice(2)
      entries.push({
        type: "untracked",
        path,
        indexStatus: "?",
        workTreeStatus: "?",
        staged: false,
        unstaged: true,
      })
    } else if (marker === "!") {
      // Ignored — skip unless we want to show them
    }
  }

  return entries
}

function inferType(X: string, Y: string): FileStatus {
  const c = X !== "." ? X : Y
  switch (c) {
    case "A": return "added"
    case "D": return "deleted"
    case "R": return "renamed"
    case "C": return "copied"
    case "U": return "unmerged"
    case "?": return "untracked"
    default:  return "modified"
  }
}

// ---------------------------------------------------------------------------
// Log (git log with custom format)
// ---------------------------------------------------------------------------

export interface LogEntry {
  hash: string
  shortHash: string
  author: string
  authorEmail: string
  authorDate: string
  committerDate: string
  relativeDate: string
  subject: string
  body: string
  refs: string[]         // branch names, tags at this commit
  parents: string[]      // parent hashes
  gpgStatus: string      // G=good, B=bad, U=untrusted, N=no sig
}

const LOG_SEP = "\x00"
const LOG_RECORD_SEP = "\x01"

/** Format string for git log — fields separated by NUL, records by SOH */
export const LOG_FORMAT =
  `%H${LOG_SEP}%h${LOG_SEP}%an${LOG_SEP}%ae${LOG_SEP}%ai${LOG_SEP}%ci${LOG_SEP}%ar${LOG_SEP}%s${LOG_SEP}%b${LOG_SEP}%D${LOG_SEP}%P${LOG_SEP}%G?${LOG_RECORD_SEP}`

export function parseLog(output: string): LogEntry[] {
  const entries: LogEntry[] = []
  const records = output.split(LOG_RECORD_SEP).filter(s => s.trim())

  for (const record of records) {
    const fields = record.split(LOG_SEP)
    if (fields.length < 12) continue

    const [
      hash = "",
      shortHash = "",
      author = "",
      authorEmail = "",
      authorDate = "",
      committerDate = "",
      relativeDate = "",
      subject = "",
      body = "",
      refsRaw = "",
      parentsRaw = "",
      gpgStatus = "N",
    ] = fields

    const refs = refsRaw
      .split(",")
      .map(r => r.trim())
      .filter(Boolean)

    const parents = parentsRaw.trim().split(/\s+/).filter(Boolean)

    entries.push({
      hash: hash.trim(),
      shortHash: shortHash.trim(),
      author: author.trim(),
      authorEmail: authorEmail.trim(),
      authorDate: authorDate.trim(),
      committerDate: committerDate.trim(),
      relativeDate: relativeDate.trim(),
      subject: subject.trim(),
      body: body.trim(),
      refs,
      parents,
      gpgStatus: gpgStatus.trim(),
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Branches (git for-each-ref)
// ---------------------------------------------------------------------------

export interface BranchEntry {
  name: string           // short name (without refs/heads/ or refs/remotes/)
  fullRef: string        // full ref path
  current: boolean
  remote: boolean
  remoteName?: string    // e.g. "origin"
  upstream?: string      // tracking branch full name
  ahead: number
  behind: number
  lastCommitHash: string
  lastCommitSubject: string
  lastCommitDate: string
}

const BRANCH_SEP = "\t"

/** Format for git for-each-ref */
export const BRANCH_FORMAT =
  "%(refname)%(TAB)%(objectname:short)%(TAB)%(subject)%(TAB)%(committerdate:relative)%(TAB)%(upstream)%(TAB)%(upstream:track,nobracket)"

export function parseBranches(output: string, currentBranch: string): BranchEntry[] {
  const entries: BranchEntry[] = []
  const lines = output.split("\n").filter(Boolean)

  for (const line of lines) {
    const [
      fullRef = "",
      hash = "",
      subject = "",
      date = "",
      upstream = "",
      track = "",
    ] = line.split(BRANCH_SEP)

    const isRemote = fullRef.startsWith("refs/remotes/")
    const isLocal = fullRef.startsWith("refs/heads/")
    if (!isRemote && !isLocal) continue

    const name = isRemote
      ? fullRef.replace("refs/remotes/", "")
      : fullRef.replace("refs/heads/", "")

    const remoteName = isRemote ? name.split("/")[0] : undefined

    // Parse ahead/behind from track string like "ahead 2, behind 1"
    let ahead = 0
    let behind = 0
    const aheadMatch = /ahead (\d+)/.exec(track)
    const behindMatch = /behind (\d+)/.exec(track)
    if (aheadMatch?.[1]) ahead = parseInt(aheadMatch[1], 10)
    if (behindMatch?.[1]) behind = parseInt(behindMatch[1], 10)

    entries.push({
      name,
      fullRef,
      current: name === currentBranch && isLocal,
      remote: isRemote,
      remoteName,
      upstream: upstream || undefined,
      ahead,
      behind,
      lastCommitHash: hash,
      lastCommitSubject: subject,
      lastCommitDate: date,
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Stash list (git stash list)
// ---------------------------------------------------------------------------

export interface StashEntry {
  index: number
  ref: string            // e.g. "stash@{0}"
  branch: string         // branch it was stashed from
  message: string
  hash: string
}

export function parseStashList(output: string): StashEntry[] {
  const entries: StashEntry[] = []
  const lines = output.split("\n").filter(Boolean)

  for (const line of lines) {
    // Format: stash@{N}: On <branch>: <message>
    //      or stash@{N}: WIP on <branch>: <hash> <message>
    const match = /^(stash@\{(\d+)\}): (.+)$/.exec(line)
    if (!match) continue

    const ref = match[1] ?? ""
    const index = parseInt(match[2] ?? "0", 10)
    const rest = match[3] ?? ""

    let branch = "unknown"
    let message = rest

    const onMatch = /^(?:WIP )?[Oo]n ([^:]+): (.+)$/.exec(rest)
    if (onMatch) {
      branch = onMatch[1] ?? "unknown"
      message = onMatch[2] ?? rest
    }

    entries.push({ index, ref, branch, message, hash: "" })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Diff stat (git diff --stat)
// ---------------------------------------------------------------------------

export interface DiffStatFile {
  path: string
  additions: number
  deletions: number
  binary: boolean
}

export interface DiffStat {
  files: DiffStatFile[]
  totalAdditions: number
  totalDeletions: number
}

export function parseDiffStat(output: string): DiffStat {
  const files: DiffStatFile[] = []
  let totalAdditions = 0
  let totalDeletions = 0

  const lines = output.split("\n").filter(Boolean)

  for (const line of lines) {
    // Summary line: " 3 files changed, 45 insertions(+), 12 deletions(-)"
    const summaryMatch = /(\d+) files? changed/.exec(line)
    if (summaryMatch) {
      const insMatch = /(\d+) insertion/.exec(line)
      const delMatch = /(\d+) deletion/.exec(line)
      if (insMatch?.[1]) totalAdditions = parseInt(insMatch[1], 10)
      if (delMatch?.[1]) totalDeletions = parseInt(delMatch[1], 10)
      continue
    }

    // File line: " path/to/file | 10 +++++-----"
    const fileMatch = /^ (.+?) \|(.+)$/.exec(line)
    if (!fileMatch) continue

    const path = (fileMatch[1] ?? "").trim()
    const statPart = (fileMatch[2] ?? "").trim()

    if (statPart.toLowerCase().includes("bin")) {
      files.push({ path, additions: 0, deletions: 0, binary: true })
    } else {
      const plus = (statPart.match(/\+/g) ?? []).length
      const minus = (statPart.match(/-/g) ?? []).length
      files.push({ path, additions: plus, deletions: minus, binary: false })
    }
  }

  return { files, totalAdditions, totalDeletions }
}

// ---------------------------------------------------------------------------
// Blame (git blame --porcelain)
// ---------------------------------------------------------------------------

export interface BlameEntry {
  hash: string
  origLine: number
  finalLine: number
  author: string
  authorEmail: string
  authorTime: number
  summary: string
  content: string
}

export function parseBlame(output: string): BlameEntry[] {
  const entries: BlameEntry[] = []
  const lines = output.split("\n")
  let i = 0

  while (i < lines.length) {
    const headerLine = lines[i]
    if (!headerLine) { i++; continue }

    // Header: <hash> <orig-line> <final-line> [<num-lines>]
    const headerMatch = /^([0-9a-f]{40}) (\d+) (\d+)/.exec(headerLine)
    if (!headerMatch) { i++; continue }

    const hash = headerMatch[1] ?? ""
    const origLine = parseInt(headerMatch[2] ?? "0", 10)
    const finalLine = parseInt(headerMatch[3] ?? "0", 10)

    let author = ""
    let authorEmail = ""
    let authorTime = 0
    let summary = ""
    i++

    // Read tag lines until we hit the content line (starts with \t)
    while (i < lines.length && !lines[i]?.startsWith("\t")) {
      const tag = lines[i] ?? ""
      if (tag.startsWith("author ") && !tag.startsWith("author-")) {
        author = tag.slice(7)
      } else if (tag.startsWith("author-mail ")) {
        authorEmail = tag.slice(12).replace(/[<>]/g, "")
      } else if (tag.startsWith("author-time ")) {
        authorTime = parseInt(tag.slice(12), 10)
      } else if (tag.startsWith("summary ")) {
        summary = tag.slice(8)
      }
      i++
    }

    const contentLine = lines[i] ?? ""
    const content = contentLine.startsWith("\t") ? contentLine.slice(1) : contentLine
    i++

    entries.push({ hash, origLine, finalLine, author, authorEmail, authorTime, summary, content })
  }

  return entries
}

// ---------------------------------------------------------------------------
// Remote info (git remote -v)
// ---------------------------------------------------------------------------

export interface RemoteEntry {
  name: string
  fetchUrl: string
  pushUrl: string
}

export function parseRemotes(output: string): RemoteEntry[] {
  const map = new Map<string, Partial<RemoteEntry>>()
  const lines = output.split("\n").filter(Boolean)

  for (const line of lines) {
    // format: <name>\t<url> (fetch|push)
    const m = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line)
    if (!m) continue
    const [, name = "", url = "", type = ""] = m
    if (!map.has(name)) map.set(name, { name })
    const entry = map.get(name)!
    if (type === "fetch") entry.fetchUrl = url
    else entry.pushUrl = url
  }

  return Array.from(map.values()) as RemoteEntry[]
}
