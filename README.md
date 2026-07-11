# 🎓 Placement Outreach OS & Application Tracker

A premium, self-contained dashboard built to automate and track cold email outreach campaigns for placements (jobs and internships) and manage your applications pipeline on a drag-and-drop Kanban board.

---

## 🚀 Key Features

* **5 Campaign Streams**: Tailored sequences with pre-seeded templates for:
  1. Finance (IB, Valuations, Markets)
  2. Consulting (Strategy, Growth, Case Preparation)
  3. Marketing (Brand Strategy, Growth, D2C)
  4. Tech (Software Engineering, System Design, FastAPI/Python stacks)
  5. All-Purpose (General Outreach)
* **Native Rich Text Editor**: Write emails using HTML format with bolding, italics, underlines, bullet lists, and anchor hyperlinks.
* **Email Analytics (Opens & Clicks)**: Tracks if your emails are opened (👁️) and if links (like Calendly or portfolio items) are clicked (🔗) via tracking pixels and redirection routing.
* **IMAP Inbox Reply Sync**: One-click sync that scans your Gmail Inbox. If a recruiter replies, it automatically halts scheduled follow-ups and moves the Kanban card to the "Interviewing" stage.
* **Interactive Spreadsheet Grid**: Directly type or paste your leads (Recruiter Email, Name, Company, Target Division) into an editable grid to generate follow-up schedules.
* **Personal Resume Locker**: Upload campaign-specific resumes (e.g. Consulting CV, Tech Resume) to attach to the initial outreach automatically.

---

## 🛠️ Setup & Running Instructions

### 1. Prerequisites
* **Python**: Make sure Python 3.10 or newer is installed on your computer.
* **Gmail App Password**: 
  1. Go to your Google Account Settings.
  2. Turn on **2-Step Verification** (required by Google to generate app passwords).
  3. Search for **App passwords** in the search bar.
  4. Create a new app (name it `Placement OS`) and copy the generated **16-character password** (e.g. `abcd efgh ijkl mnop`).

### 2. How to Run the App

#### On Windows:
1. Double-click the file named **`run.bat`** in the project folder.
2. The script will automatically:
   * Setup a Python virtual environment (`.venv`).
   * Install all required dependencies (FastAPI, Uvicorn, Python-Multipart).
   * Initialize the SQLite database.
   * Start the server on port **`8001`** and open the app in your browser at `http://127.0.0.1:8001`.

#### On macOS / Linux:
1. Open a terminal in the project folder.
2. Make the script executable:
   ```bash
   chmod +x run.sh
   ```
3. Run the script:
   ```bash
   ./run.sh
   ```

---

## 📖 First Run Walkthrough

1. **Register Your Account**:
   Since the app runs completely locally, the database starts empty. Click the **Register** tab on the login screen, type in a username and password, and register. Then switch to the **Sign In** tab to log in.
2. **Configure Settings**:
   Go to the **Settings & Resumes** tab. Enter your Gmail address, the 16-character Gmail App Password you generated, and your name/signature. Click **Save Settings**.
3. **Upload Your Resumes**:
   In the settings tab, choose the campaign stream (e.g. Tech) and upload your target PDF resume.
4. **Load & Schedule Leads**:
   Go to the **Lead Grid** tab, paste recruiter emails and company names in the spreadsheet, select your start date, and click **Generate Schedule**.
5. **Start Campaign**:
   Go to the **Dashboard** and click **Start Campaign Send** to start dispatching due emails.

---

## 💻 Tech Stack
* **Backend**: FastAPI (Python), SQLite (Database), `python-multipart`
* **Frontend**: HTML5, Vanilla CSS3 (Custom styling and glows), Vanilla JavaScript (ES6)
