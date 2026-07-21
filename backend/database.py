import sqlite3
import hashlib
import os
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "placement_tracker.db")

DEFAULT_TEMPLATES = {
    "finance": {
        "initial": {
            "subject": "Opportunities in {{Division}} at {{Company}} — {{SenderName}}",
            "body": """Good Morning, I hope you are doing well<br><br>I realise that your schedule is very valuable, so I'll Keep it short.<br>I'm a 2nd year student at Ramjas College, University of Delhi, passionate about and exploring core finance, public and private markets for the last 18 months. I'm seeking a {{RoleType}} at {{Company}} in the {{Division}} to gain real-time exposure and experience. I am open to long-working hours and in-office commitments, as I strongly believe sustained learning is critical in the early stages of my career.<br><br>Something that might make me a tad bit more relevant-<br><br>- 1. A 1 Month VC Scouting Intern at Foxhog, A 2 Month Investment Banking Intern at StartupLanes, an England based fundraising platform and a 2 Month Transaction Advisory Intern at Plutus Business Advisory, a Boutique IB to understand the nature of such roles<br><br>- 2. Live Projects at firms like Findoc, Rapido, CRY, Bombay Shaving Company, ZYBER and Saveit across several Verticals to understand Corporate Culture<br><br>- 3. PORs in several top Societies including International Finance Student Association Ramjas, Placement Cell and The Entrepreneurship cell providing the appropriate fit for the role<br><br>I am attaching my CV for your reference. I would be grateful if my profile could be considered for any suitable opportunities or related teams.<br><br>I understand this may not directly fall within your area of responsibility, but I would sincerely appreciate any guidance or consideration that could help me explore relevant opportunities within the organization.<br><br>I am eager to learn, willing to put in the required effort, and excited about the possibility of contributing while gaining exposure from industry leaders at {{Company}}.<br><br>Looking forward to being an asset to the team, thanks for your time and the read<br>Best,<br><br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 0
        },
        "f1": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I hope you're having a good week.<br><br>Just wanted to follow up on my previous email regarding SDE/Finance opportunities at {{Company}}. I understand you have a busy schedule, so I wanted to re-attach my CV here for quick reference in case it got buried.<br><br>Would love to connect if there's any opening or if you could point me to the right team.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 3
        },
        "f2": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you are doing well.<br><br>To share a quick update: I recently completed a detailed analysis on public equity valuation models and wrapped up my Investment Banking internship with StartupLanes.<br><br>Given {{Company}}'s incredible work in {{Division}}, I'm very keen to bring my analytical skills to your team. Please let me know if you have 10 minutes for a brief call this week.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 7
        },
        "f3": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you are having a productive week.<br><br>I wanted to share a quick research note I put together recently on market trends affecting the valuation industry, which aligns closely with the work {{Company}} does.<br><br>If you have any feedback or if there's a possibility of exploring an internship or entry-level role, I would be extremely grateful to chat.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 11
        },
        "f4": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I know you receive a lot of outreach, so this will be my final follow-up.<br><br>If {{Company}} isn't hiring for {{Division}} roles currently, no worries at all! I'll close the loop on this thread for now. Feel free to keep my CV on file should any opportunity open up in the future.<br><br>Thanks again for your time and consideration.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 15
        }
    },
    "consulting": {
        "initial": {
            "subject": "Opportunities in {{Division}} at {{Company}} — {{SenderName}}",
            "body": """Good Morning, I hope you are doing well<br><br>I realise that your schedule is very valuable, so I'll Keep it short.<br>I'm a 2nd year student at Ramjas College, University of Delhi, passionate about management consulting, strategy, and corporate growth. I'm seeking a {{RoleType}} at {{Company}} in the {{Division}} to gain real-time exposure. I am open to intensive workloads and in-office commitments, as I believe sustained learning is critical in the early stages of my career.<br><br>Something that might make me a tad bit more relevant-<br><br>- 1. Handled client-facing Live Projects at firms like Findoc, Rapido, CRY, Bombay Shaving Company, ZYBER, and Saveit, delivering consumer research, market sizing, and corporate strategies.<br><br>- 2. Developed analytical and financial modeling capabilities through transaction advisory and IB internships (Plutus, StartupLanes, Foxhog).<br><br>- 3. Held PORs in several top Societies including IFSA Ramjas, the Placement Cell, and the Entrepreneurship Cell, managing corporate relations and team deliverables.<br><br>I am attaching my Consulting CV for your reference. I would be grateful if my profile could be considered for any suitable opportunities or related teams.<br><br>I understand this may not directly fall within your area of responsibility, but I would sincerely appreciate any guidance or consideration that could help me explore relevant opportunities within the organization.<br><br>I am eager to learn, willing to put in the required effort, and excited about the possibility of contributing while gaining exposure from industry leaders at {{Company}}.<br><br>Looking forward to being an asset to the team, thanks for your time and the read<br>Best,<br><br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 0
        },
        "f1": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I hope you're doing well.<br><br>Bumping this to check if you had a brief moment to look over my consulting CV. If you're currently hiring interns or analysts for the {{Division}} team at {{Company}}, I'd love to jump on a short introductory call.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 3
        },
        "f2": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you're having a good week.<br><br>To share a quick update on my consulting preparation, I recently finished a comprehensive growth strategy case study for a D2C brand, building on the live project work I did for Bombay Shaving Company (where my Gen Z research drove 100K+ views).<br><br>I'd love to share my findings with you or discuss how I could add value to {{Company}}'s current client projects.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 7
        },
        "f3": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope all is well.<br><br>I know how fast-paced consulting can be, so I'll keep this short. If there are any open client-facing roles or internships in your team, I am eager to put in the hours and learn from the best at {{Company}}.<br><br>Would love to connect if you have 10 minutes next week.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 11
        },
        "f4": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I'll close the loop on this thread as I understand you are busy.<br><br>If there are no opportunities in the {{Division}} division at {{Company}} right now, I completely understand. I've attached my CV one last time in case you'd like to save it for the future.<br><br>Thank you so much for your time.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 15
        }
    },
    "marketing": {
        "initial": {
            "subject": "Opportunities in {{Division}} at {{Company}} — {{SenderName}}",
            "body": """Good Morning, I hope you are doing well<br><br>I realise that your schedule is very valuable, so I'll Keep it short.<br>I'm a 2nd year student at Ramjas College, University of Delhi, passionate about marketing, brand strategy, and growth. I'm seeking a {{RoleType}} at {{Company}} in the {{Division}} to gain hands-on marketing exposure. I am highly motivated and open to in-office commitments.<br><br>Something that might make me a tad bit more relevant-<br><br>- 1. Gen Z consumer research live project at Bombay Shaving Company (directly shaped 4 brand reels generating 100K+ views), and campus rollout support for Zyber (scaled from 0 to 16 colleges in 20 days).<br><br>- 2. Executed Live marketing and GTM strategy sprints at firms like Rapido, Findoc, Saveit, and CRY.<br><br>- 3. PORs in key societies like the Placement Cell and the Entrepreneurship Cell, leading student outreach and brand engagement campaigns.<br><br>I am attaching my Marketing CV for your reference. I would be grateful if my profile could be considered for any suitable opportunities or related teams.<br><br>I understand this may not directly fall within your area of responsibility, but I would sincerely appreciate any guidance or consideration that could help me explore relevant opportunities within the organization.<br><br>I am eager to learn, willing to put in the required effort, and excited about the possibility of contributing while gaining exposure from industry leaders at {{Company}}.<br><br>Looking forward to being an asset to the team, thanks for your time and the read<br>Best,<br><br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 0
        },
        "f1": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I hope you're doing well.<br><br>Just following up to see if you had a chance to look at my resume for potential marketing roles. I'd love to chat briefly about how my background in Gen Z consumer research can help drive growth at {{Company}}.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 3
        },
        "f2": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you're having a great week.<br><br>Just a quick update: I recently launched a viral student engagement campaign at Ramjas Placement Cell, growing our digital reach by 40% over the last few weeks. <br><br>I'd love to bring this kind of results-driven execution to the {{Division}} team at {{Company}}. Let me know if you have a few minutes to connect.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 7
        },
        "f3": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you are well.<br><br>I wanted to follow up with a brief copy pitch/creative concept I drafted for {{Company}}'s latest campaign, applying the brand strategy insights I gained during my time at Bombay Shaving Company.<br><br>Would love to jump on a short call to discuss if it might be useful!<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 11
        },
        "f4": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I know how busy your schedule is, so I'll wrap up this thread.<br><br>If there are no vacancies or internship slots right now, no worries! I've attached my marketing CV for future reference. Thanks for your time!<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 15
        }
    },
    "tech": {
        "initial": {
            "subject": "Opportunities in {{Division}} at {{Company}} — {{SenderName}}",
            "body": """Good Morning, I hope you are doing well<br><br>I realise that your schedule is very valuable, so I'll Keep it short.<br>I'm a 2nd year student at Ramjas College, University of Delhi, passionate about software engineering, system design, and building scalable applications. I'm seeking a {{RoleType}} at {{Company}} in the {{Division}} to gain real-time engineering exposure. I am open to intensive workloads and in-office commitments, as I believe sustained learning is critical in the early stages of my career.<br><br>Something that might make me a tad bit more relevant-<br><br>- 1. Explored core tech stacks through hands-on development, including building personal projects using Python, FastAPI, SQLite, and vanilla HTML/CSS/JS web applications.<br><br>- 2. Handled Live Projects at firms like Rapido (analyzed Captain app driver feedback feeding directly into their product roadmap) and Zyber (scaled campus rollout from 0 to 16 colleges in 20 days).<br><br>- 3. PORs in key societies including the Placement Cell and the Entrepreneurship Cell, leading tech operations, managing database tracking pipelines, and orchestrating society web portals.<br><br>I am attaching my Resume for your reference. I would be grateful if my profile could be considered for any suitable opportunities or related teams.<br><br>I understand this may not directly fall within your area of responsibility, but I would sincerely appreciate any guidance or consideration that could help me explore relevant opportunities within the organization.<br><br>I am eager to learn, willing to put in the required effort, and excited about the possibility of contributing while gaining exposure from tech leaders at {{Company}}.<br><br>Looking forward to being an asset to the team, thanks for your time and the read<br>Best,<br><br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 0
        },
        "f1": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I hope you're having a good week.<br><br>Just wanted to follow up on my previous email regarding SDE opportunities at {{Company}}. I understand you have a busy schedule, so I wanted to re-attach my Resume here for quick reference in case it got buried.<br><br>Would love to connect if there's any opening or if you could point me to the right team.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 3
        },
        "f2": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you are doing well.<br><br>To share a quick update: I recently completed a detailed project building a self-contained web platform with FastAPI, SQLite, and a background task processor, solving system integration challenges.<br><br>Given {{Company}}'s work in {{Division}}, I'm very keen to bring my development skills to your team. Please let me know if you have 10 minutes for a brief call this week.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 7
        },
        "f3": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you are having a productive week.<br><br>I wanted to share a link to my GitHub portfolio where I have detailed the system architecture of the applications I've built, reflecting clean coding standards and database structures.<br><br>If you have any feedback or if there's a possibility of exploring an internship or entry-level role, I would be extremely grateful to chat.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 11
        },
        "f4": {
            "subject": "Re: Opportunities in {{Division}} at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I know you receive a lot of outreach, so this will be my final follow-up.<br><br>If {{Company}} isn't hiring for {{Division}} roles currently, no worries at all! I'll close the loop on this thread for now. Feel free to keep my Resume on file should any opportunity open up in the future.<br><br>Thanks again for your time and consideration.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 15
        }
    },
    "all_purpose": {
        "initial": {
            "subject": "Opportunities / Collaboration Proposal at {{Company}} — {{SenderName}}",
            "body": """Good Morning, I hope you are doing well<br><br>I realise that your schedule is very valuable, so I'll Keep it short.<br>I'm a 2nd year student at Ramjas College, University of Delhi, passionate about career exploration across finance, consulting, and management. I'm seeking a {{RoleType}} at {{Company}} in the {{Division}} to gain real-time corporate experience.<br><br>Something that might make me a tad bit more relevant-<br><br>- 1. Corporate internships (Foxhog, StartupLanes, Plutus Business Advisory) in research, advisory, and operations.<br><br>- 2. Handled Live Projects at firms like Findoc, Rapido, CRY, Bombay Shaving Company, ZYBER, and Saveit across several business verticals.<br><br>- 3. Held PORs in several top societies (Placement Cell, E-Cell) driving corporate engagement and project management.<br><br>I am attaching my CV for your reference. I would be grateful if my profile could be considered for any suitable opportunities or related teams.<br><br>I understand this may not directly fall within your area of responsibility, but I would sincerely appreciate any guidance or consideration that could help me explore relevant opportunities within the organization.<br><br>I am eager to learn, willing to put in the required effort, and excited about the possibility of contributing while gaining exposure from industry leaders at {{Company}}.<br><br>Looking forward to being an asset to the team, thanks for your time and the read<br>Best,<br><br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 0
        },
        "f1": {
            "subject": "Re: Opportunities at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I hope you are doing well.<br><br>Just wanted to follow up on my previous message. I understand you are busy, but I wanted to check if you had a moment to review my attached CV.<br><br>I look forward to hearing from you.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 3
        },
        "f2": {
            "subject": "Re: Opportunities at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>Hope you're having a good week.<br><br>I'm checking in to see if there are any openings for internships or jobs in the {{Division}} division. I've been refining my skill set through recent projects and would love to contribute to {{Company}}.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 7
        },
        "f3": {
            "subject": "Re: Opportunities at {{Company}}",
            "body": """Hi {{FirstName}},<br><br>I wanted to quickly follow up in case my previous mail got buried. I know you receive a lot of messages, so I'll keep this short.<br><br>If you have 10 minutes sometime next week, I'd love to connect and share more about how I can add value to the team.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 11
        },
        "f4": {
            "subject": "Re: closing this thread",
            "body": """Hi {{FirstName}},<br><br>I know you have a busy schedule, so I will close the loop on this thread for now.<br><br>If there isn't a priority for hiring in {{Division}} at this time, no worries at all! Feel free to drop a line if things open up in the future.<br><br>Best,<br>{{SenderName}}<br>{{SenderPhone}}""",
            "day_offset": 15
        }
    }
}


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # User table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""")

    # Active login sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # User Settings / Signature
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY,
        sender_name TEXT,
        sender_phone TEXT,
        gmail_user TEXT,
        gmail_app_password TEXT,
        emergency_stop INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # Attachments locker (supports individual campaigns)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        campaign_id TEXT NOT NULL, -- 'finance', 'consulting', 'marketing', 'tech', 'all_purpose'
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # Templates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS templates (
        user_id INTEGER NOT NULL,
        campaign_id TEXT NOT NULL,
        step_key TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        day_offset INTEGER NOT NULL,
        PRIMARY KEY (user_id, campaign_id, step_key),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # Leads and schedule queue
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        campaign_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT,
        company TEXT,
        role TEXT, -- e.g. 'Job' or 'Internship'
        custom_field_1 TEXT, -- Division (e.g. Valuations/Investments Division)
        custom_field_2 TEXT, -- Extra custom field
        status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Sent', 'Replied', 'Call Booked', 'Closed', 'Failed'
        stage_step TEXT NOT NULL, -- 'initial', 'f1', 'f2', etc.
        scheduled_date TEXT NOT NULL,
        last_sent_at TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    # Application Tracker table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        role_type TEXT NOT NULL, -- 'Job' or 'Internship'
        division TEXT,
        contact_name TEXT,
        contact_email TEXT,
        status TEXT NOT NULL DEFAULT 'Wishlist', -- 'Wishlist', 'Applied', 'OA / Test', 'Interviewing', 'Offer', 'Rejected'
        notes TEXT,
        last_updated TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")

    conn.commit()

    # Column migrations for open and click tracking
    try:
        cursor.execute("ALTER TABLE schedule ADD COLUMN open_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE schedule ADD COLUMN click_count INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE settings ADD COLUMN public_url TEXT DEFAULT 'http://127.0.0.1:8001'")
    except sqlite3.OperationalError:
        pass
    conn.commit()

    # Ensure default local user (id=1) and settings exist for seamless desktop app usage
    row_user = cursor.execute("SELECT id FROM users WHERE id = 1").fetchone()
    if not row_user:
        now_ts = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (1, 'local_user', '', '', ?)",
            (now_ts,)
        )
        cursor.execute(
            "INSERT INTO settings (user_id, sender_name, sender_phone, gmail_user, gmail_app_password, emergency_stop, public_url) VALUES (1, 'Varun Bhardwaj', '', '', '', 0, 'http://127.0.0.1:8001')"
        )
        conn.commit()

    # Seed default templates for all registered users if they are missing
    users = cursor.execute("SELECT id FROM users").fetchall()
    for u in users:
        u_id = u["id"]
        for campaign_id, steps in DEFAULT_TEMPLATES.items():
            for step_key, data in steps.items():
                cursor.execute("""
                    INSERT OR IGNORE INTO templates (user_id, campaign_id, step_key, subject, body, day_offset)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (u_id, campaign_id, step_key, data["subject"], data["body"], data["day_offset"]))
    conn.commit()
    conn.close()


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return hashed, salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    hashed, _ = hash_password(password, salt)
    return hmac_compare(hashed, password_hash)


def hmac_compare(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0


def create_user(username, password):
    conn = get_db()
    cursor = conn.cursor()
    try:
        password_hash, salt = hash_password(password)
        now = datetime.now().isoformat()
        cursor.execute(
            "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
            (username.strip().lower(), password_hash, salt, now)
        )
        user_id = cursor.lastrowid

        # Insert default settings
        cursor.execute(
            "INSERT INTO settings (user_id, sender_name, sender_phone, gmail_user, gmail_app_password, emergency_stop, public_url) VALUES (?, ?, ?, ?, ?, 0, 'http://127.0.0.1:8001')",
            (user_id, username, "", "", "")
        )

        # Seed default templates for this user
        for campaign_id, steps in DEFAULT_TEMPLATES.items():
            for step_key, data in steps.items():
                cursor.execute("""
                    INSERT INTO templates (user_id, campaign_id, step_key, subject, body, day_offset)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, campaign_id, step_key, data["subject"], data["body"], data["day_offset"]))

        conn.commit()
        return user_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()


def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at)
    )
    conn.commit()
    conn.close()
    return token


def get_user_from_session(token: str):
    if not token:
        return None
    conn = get_db()
    row = conn.execute("""
        SELECT u.id, u.username
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
    """, (token, datetime.now().isoformat())).fetchone()
    conn.close()
    if row:
        return {"id": row["id"], "username": row["username"]}
    return None


def destroy_session(token: str):
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
