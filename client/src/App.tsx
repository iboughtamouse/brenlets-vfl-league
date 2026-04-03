import { useEffect, useState } from 'preact/hooks';
import './App.css';

interface Standing {
  vfl_id: number;
  manager: string;
  url: string;
  team_name: string | null;
  event: string;
  game_week: number;
  points: number;
  scraped_at: string;
}

interface WeeksResponse {
  event: string | null;
  weeks: number[];
  latest: number | null;
}

interface StandingsResponse {
  standings: Standing[];
  event: string | null;
  gameWeek: number | 'total' | null;
}

interface EventsResponse {
  events: string[];
  latest: string | null;
}

// Generate visitor count once at module level (not during render)
const VISITOR_COUNT = Math.floor(Math.random() * 99999) + 10000;

function App() {
  const [events, setEvents] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | 'total' | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available events + game weeks on mount, then load the latest standings
  useEffect(() => {
    Promise.all([
      fetch('/api/standings/events').then((res) => res.json()) as Promise<EventsResponse>,
      fetch('/api/standings/weeks').then((res) => res.json()) as Promise<WeeksResponse>,
    ])
      .then(([eventsData, weeksData]) => {
        setEvents(eventsData.events);
        setSelectedEvent(weeksData.event);
        setWeeks(weeksData.weeks);
        if (weeksData.latest != null) {
          setSelectedWeek(weeksData.latest);
          const params = new URLSearchParams({ gw: String(weeksData.latest) });
          if (weeksData.event) params.set('event', weeksData.event);
          return fetch(`/api/standings?${params}`)
            .then((res) => res.json())
            .then((standingsData: StandingsResponse) => {
              setStandings(standingsData.standings);
            });
        }
      })
      .catch(() => {
        setError('Failed to load data.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function selectEvent(event: string) {
    setSelectedEvent(event);
    setLoading(true);
    setError(null);
    fetch(`/api/standings/weeks?${new URLSearchParams({ event })}`)
      .then((res) => res.json())
      .then((weeksData: WeeksResponse) => {
        setWeeks(weeksData.weeks);
        const latestWeek = weeksData.latest;
        if (latestWeek != null) {
          setSelectedWeek(latestWeek);
          return fetch(`/api/standings?${new URLSearchParams({ event, gw: String(latestWeek) })}`)
            .then((res) => res.json())
            .then((data: StandingsResponse) => {
              setStandings(data.standings);
            });
        } else {
          setSelectedWeek(null);
          setStandings([]);
        }
      })
      .catch(() => {
        setError('Failed to load event.');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function selectWeek(week: number | 'total') {
    setSelectedWeek(week);
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ gw: String(week) });
    if (selectedEvent) params.set('event', selectedEvent);
    fetch(`/api/standings?${params}`)
      .then((res) => res.json())
      .then((data: StandingsResponse) => {
        setStandings(data.standings);
      })
      .catch(() => {
        setError('Failed to load standings.');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  const topScorer = standings.length > 0 ? standings[0].manager : '???';
  const biggestL = standings.length > 0 ? standings[standings.length - 1].manager : '???';

  return (
    <div className="retro-page">
      {/* Animated background stars */}
      <div className="stars"></div>

      {/* Header */}
      <header className="retro-header">
        <div className="flame-border"></div>
        <h1 className="retro-title">
          <span className="blink">★</span> BRENLETS VFL <span className="blink">★</span>
        </h1>
        <div className="subtitle">~*~*~ ULTIMATE FANTASY VALORANT LEAGUE ~*~*~</div>
        <div className="flame-border"></div>
      </header>

      {/* Marquee */}
      <div className="marquee-container">
        <marquee behavior="scroll" direction="left">
          ✨ Welcome to the OFFICIAL Brenlets VFL Stats Page! ✨ Updated Daily! ✨ Tell Your
          Friends! ✨ GG NO RE ✨
        </marquee>
      </div>

      {/* Main Content */}
      <main className="content-area">
        {/* Event Selector */}
        {events.length > 0 && (
          <div className="event-selector">
            <label htmlFor="event-select" className="selector-label">
              🌍 Select event 🌍
            </label>
            <select
              id="event-select"
              className="event-dropdown"
              value={selectedEvent ?? ''}
              onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                if (val) selectEvent(val);
              }}
            >
              {events.map((event) => (
                <option key={event} value={event}>
                  ★ {event} ★
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Week Selector */}
        <div className="week-selector">
          <label htmlFor="gw-select" className="selector-label">
            ⚔️ Select game week ⚔️
          </label>
          <select
            id="gw-select"
            className="week-dropdown"
            value={selectedWeek ?? ''}
            onChange={(e) => {
              const val = (e.target as HTMLSelectElement).value;
              selectWeek(val === 'total' ? 'total' : Number(val));
            }}
          >
            {weeks.map((week) => (
              <option key={week} value={week}>
                ★ Game Week {week} ★
              </option>
            ))}
            {weeks.length > 0 && <option value="total">🏆 EVENT TOTAL 🏆</option>}
          </select>
        </div>

        {/* Standings Table */}
        <div className="table-container">
          <div className="table-header-bar">
            <span className="blink">◆</span>{' '}
            {selectedWeek === 'total' ? 'EVENT TOTAL' : `GAME WEEK ${selectedWeek ?? '?'}`}{' '}
            STANDINGS <span className="blink">◆</span>
          </div>

          {loading ? (
            <div className="loading-text">Loading scores...</div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : standings.length === 0 ? (
            <div className="loading-text">No standings data yet.</div>
          ) : (
            <table className="standings-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>MANAGER</th>
                  <th>TEAM NAME</th>
                  <th>POINTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr
                    key={standing.vfl_id}
                    className={`${index % 2 === 0 ? 'even-row' : 'odd-row'} clickable-row`}
                    onClick={() => window.open(standing.url, '_blank')}
                  >
                    <td className="rank-cell">
                      {index < 3 && <span className="trophy">🏆</span>}#{index + 1}
                    </td>
                    <td className="manager-cell">{standing.manager}</td>
                    <td className="team-cell">{standing.team_name ?? 'Unknown'}</td>
                    <td className="points-cell">{standing.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Divider */}
        <div className="divider">
          <hr className="fire-hr" />
        </div>

        {/* Fun Stats Section */}
        <div className="fun-stats">
          <div className="stat-box stat-box-top">
            <div className="stat-title">🔥 TOP SCORER 🔥</div>
            <div className="stat-value">{topScorer}</div>
          </div>
          <div className="stat-box stat-box-bottom">
            <div className="stat-title">💀 BIGGEST L 💀</div>
            <div className="stat-value">{biggestL}</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="retro-footer">
        <div className="flame-border"></div>
        <div className="footer-content">
          <div className="footer-row">
            <span className="footer-text">🚧 UNDER CONSTRUCTION 🚧</span>
          </div>

          <div className="visitor-counter">
            <span className="counter-label">YOU ARE VISITOR #</span>
            <span className="counter-number">{VISITOR_COUNT.toString().padStart(6, '0')}</span>
          </div>

          <div className="footer-links">
            <a
              href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Sign My Guestbook!
            </a>
            {' | '}
            <a
              href="https://twitch.tv/bren"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Email Webmaster
            </a>
            {' | '}
            <a
              href="https://x.com/MarthaStewart/status/463333915739316224"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              Awards
            </a>
          </div>

          <div className="browser-notice">
            <span className="blink">⚠</span> BEST VIEWED IN NETSCAPE NAVIGATOR 4.0{' '}
            <span className="blink">⚠</span>
          </div>

          <div className="footer-badges">
            <div className="badge">HTML 3.2</div>
            <div className="badge">GEOCITIES</div>
            <div className="badge">EST. 1999</div>
            <div className="badge">GIF FRIENDLY</div>
          </div>

          <div className="copyright">
            © 1999-2026 Brenlets VFL • All Rights Reserved • Powered by Angelfire
          </div>
        </div>
        <div className="flame-border"></div>
      </footer>
    </div>
  );
}

export default App;
