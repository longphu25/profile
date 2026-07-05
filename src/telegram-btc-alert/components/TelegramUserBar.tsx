import type { TelegramAuthState } from '../lib/telegram-user'
import { displayTelegramName } from '../lib/telegram-user'

export interface TelegramUserBarProps {
  readonly auth: TelegramAuthState
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function TelegramUserBar({ auth }: TelegramUserBarProps) {
  if (auth.status === 'loading') {
    return (
      <div className="tga__user tga__user--loading" aria-busy="true">
        <span className="tga__user-skel" />
        <span className="tga__user-meta">
          <span className="tga__user-skel tga__user-skel--line" />
        </span>
      </div>
    )
  }

  if (auth.status === 'guest' || !auth.user) {
    return (
      <div className="tga__user tga__user--guest">
        <span className="tga__user-avatar tga__user-avatar--guest" aria-hidden="true">
          TG
        </span>
        <span className="tga__user-meta">
          <span className="tga__user-name">Chưa đăng nhập</span>
          <span className="tga__user-hint">Mở từ bot Telegram để tự động đăng nhập</span>
        </span>
      </div>
    )
  }

  const name = displayTelegramName(auth.user)
  const handle = auth.user.username ? `@${auth.user.username}` : `ID ${auth.user.id}`

  return (
    <div className="tga__user">
      {auth.user.photoUrl ? (
        <img className="tga__user-avatar" src={auth.user.photoUrl} alt="" width={36} height={36} />
      ) : (
        <span className="tga__user-avatar tga__user-avatar--initials" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <span className="tga__user-meta">
        <span className="tga__user-name">{name}</span>
        <span className="tga__user-hint">
          {handle}
          {auth.verified ? ' · Đã xác thực' : ' · Phiên Telegram'}
        </span>
      </span>
    </div>
  )
}
