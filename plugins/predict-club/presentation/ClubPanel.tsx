import { usePredictClub } from './PredictClubContext'
import { Icon, labelize } from './shared'

export function ClubPanel() {
  const { club, setModal } = usePredictClub()

  return (
    <>
      <header className="pc-panel-header">
        <div>
          <h2>{club.name}</h2>
          <p>
            <Icon name="military_tech" /> Leader: <span>{club.leaderName}</span>
          </p>
        </div>
        <button
          className="pc-icon-button"
          type="button"
          onClick={() => setModal('create-round')}
          aria-label="Create prediction round"
        >
          <Icon name="add" />
        </button>
      </header>
      <div className="pc-member-bar">
        <span>Members ({club.members.length})</span>
        <span>Status</span>
      </div>
      <ul className="pc-member-list">
        {club.members.map((member) => (
          <li key={member.id}>
            <div className="pc-member-id">
              <span>{member.name.charAt(0)}</span>
              <strong>{member.name}</strong>
            </div>
            <em className={`pc-member-state pc-member-state-${member.state}`}>
              {labelize(member.state)}
            </em>
          </li>
        ))}
      </ul>
    </>
  )
}
