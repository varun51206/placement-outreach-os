import time
import imaplib
import socket

def get_smtp_ipv4_host() -> str:
    try:
        addr_info = socket.getaddrinfo("smtp.gmail.com", 587, socket.AF_INET, socket.SOCK_STREAM)
        if addr_info:
            return addr_info[0][4][0]
    except Exception:
        pass
    return "smtp.gmail.com"

import re
import os
import sqlite3
import threading
from datetime import datetime
import smtplib
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from backend.database import get_db, DB_PATH

def inject_tracking(body_html: str, public_url: str, schedule_id: int) -> str:
    public_url_clean = public_url.rstrip("/")
    
    def repl_link(match):
        url = match.group(1)
        if "/api/track/" in url or not (url.startswith("http://") or url.startswith("https://")):
            return match.group(0)
        return f'href="{public_url_clean}/api/track/click/{schedule_id}?dest={url}"'
        
    body_tracked = re.sub(r'href="([^"]+)"', repl_link, body_html)
    
    pixel_html = f'<img src="{public_url_clean}/api/track/open/{schedule_id}" width="1" height="1" style="display:none;" />'
    if "</body>" in body_tracked:
        body_tracked = body_tracked.replace("</body>", f"{pixel_html}</body>")
    else:
        body_tracked += pixel_html
        
    return body_tracked

STOP_STATUSES = ["Replied", "Call Booked", "Closed"]

# Global dict to store sending state per user
# user_id -> { is_sending: bool, sent_count: int, total_to_send: int, current_log: str }
sending_states = {}
states_lock = threading.Lock()

def sanitize_template_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    replacements = {
        "{{First Name}}": "{{FirstName}}", "{{First_Name}}": "{{FirstName}}", "{{first_name}}": "{{FirstName}}",
        "{{Company Name}}": "{{Company}}", "{{company}}": "{{Company}}",
        "{{Role Type}}": "{{RoleType}}", "{{role_type}}": "{{RoleType}}",
        "{{Sender Name}}": "{{SenderName}}", "{{Sender Phone}}": "{{SenderPhone}}",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text

def render_template(text: str, data: dict) -> str:
    out = sanitize_template_text(text)
    for k, v in data.items():
        pattern = re.compile(rf"{{{{\s*{k}\s*}}}}", re.IGNORECASE)
        out = pattern.sub(str(v if v is not None else ""), out)
    return out

def get_campaign_attachment(conn, user_id, campaign_id):
    row = conn.execute("""
        SELECT file_path, file_name 
        FROM attachments 
        WHERE user_id = ? AND campaign_id = ? 
        ORDER BY id DESC LIMIT 1
    """, (user_id, campaign_id)).fetchone()
    if row:
        return row["file_path"], row["file_name"]
    return None, None

def send_email_smtp(gmail_user, gmail_app_password, to_email, subject, body, from_name,
                     attachment_path="", attachment_name=""):
    try:
        msg = MIMEMultipart()
        msg["From"] = f"{from_name} <{gmail_user}>"
        msg["To"] = to_email.strip()
        msg["Subject"] = subject
        
        is_html_structured = "</div>" in body or "</p>" in body or "<br" in body
        is_html = is_html_structured or body.strip().startswith("<")
        mime_type = "html" if is_html else "plain"
        if mime_type == "html" and not is_html_structured:
            body = body.replace("\n", "<br>")
        if mime_type == "html":
            body = re.sub(r'\s*style="[^"]*"', '', body, flags=re.IGNORECASE)
        msg.attach(MIMEText(body, mime_type, "utf-8"))

        if attachment_path and os.path.exists(attachment_path):
            with open(attachment_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            name = attachment_name or os.path.basename(attachment_path)
            part.add_header("Content-Disposition", f'attachment; filename="{name}"')
            msg.attach(part)

        smtp_host = get_smtp_ipv4_host()
        with smtplib.SMTP(smtp_host, 587, timeout=180) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(gmail_user.strip(), gmail_app_password.strip())
            server.sendmail(gmail_user.strip(), [to_email.strip()], msg.as_string())
        return True, "Sent successfully"
    except Exception as e:
        return False, f"{type(e).__name__}: {str(e)}"

def get_user_sending_state(user_id: int):
    with states_lock:
        if user_id not in sending_states:
            sending_states[user_id] = {
                "is_sending": False,
                "sent_count": 0,
                "total_to_send": 0,
                "current_log": "Idle"
            }
        return sending_states[user_id].copy()

def set_user_sending_state(user_id: int, is_sending: bool, sent_count: int, total_to_send: int, current_log: str):
    with states_lock:
        sending_states[user_id] = {
            "is_sending": is_sending,
            "sent_count": sent_count,
            "total_to_send": total_to_send,
            "current_log": current_log
        }

def process_due_emails(user_id: int):
    # Initialize state
    set_user_sending_state(user_id, True, 0, 0, "Querying due emails...")

    conn = get_db()
    today = datetime.now().date().isoformat()
    placeholders = ",".join(["?"] * len(STOP_STATUSES))
    
    # Query due rows strictly for this user_id
    query = f"""
        SELECT s.id, s.user_id, s.campaign_id, s.email, s.first_name, s.company, s.role,
               s.custom_field_1, s.custom_field_2, s.target_type, s.stage_step,
               u.sender_name, u.sender_phone, u.gmail_user, u.gmail_app_password, u.emergency_stop
        FROM schedule s
        JOIN settings u ON s.user_id = u.user_id
        WHERE s.user_id = ?
          AND s.scheduled_date <= ?
          AND s.status = 'Pending'
          AND u.emergency_stop = 0
          AND s.email NOT IN (
              SELECT email FROM schedule 
              WHERE status IN ({placeholders}) AND user_id = s.user_id AND campaign_id = s.campaign_id
          )
        ORDER BY s.scheduled_date ASC, s.id ASC
    """
    
    try:
        rows = conn.execute(query, (user_id, today, *STOP_STATUSES)).fetchall()
    except sqlite3.OperationalError as e:
        err_msg = f"Database Error: {e}"
        print(f"[Worker] {err_msg}")
        set_user_sending_state(user_id, False, 0, 0, err_msg)
        conn.close()
        return

    total_count = len(rows)
    if total_count == 0:
        set_user_sending_state(user_id, False, 0, 0, "No pending emails scheduled for today.")
        conn.close()
        return

    set_user_sending_state(user_id, True, 0, total_count, f"Found {total_count} emails to send. Starting batch...")
    
    templates_cache = {}
    sent_count = 0

    try:
        for row in rows:
            # Check dynamic emergency stop before sending each email
            chk = conn.execute("SELECT emergency_stop FROM settings WHERE user_id = ?", (user_id,)).fetchone()
            if chk and chk["emergency_stop"]:
                log_msg = "Sending paused. Emergency Stop activated."
                print(f"[Worker] {log_msg}")
                set_user_sending_state(user_id, False, sent_count, total_count, log_msg)
                break

            row_id = row["id"]
            campaign_id = row["campaign_id"]
            to_email = row["email"]
            first_name = row["first_name"]
            company = row["company"]
            role = row["role"] # Job or Internship
            c1 = row["custom_field_1"] # Division
            c2 = row["custom_field_2"] # Custom note
            target_type_val = row["target_type"]
            stage_step = row["stage_step"]
            sender_name = row["sender_name"]
            sender_phone = row["sender_phone"]
            gmail_user = row["gmail_user"]
            gmail_app_password = row["gmail_app_password"]

            sent_count += 1
            set_user_sending_state(user_id, True, sent_count, total_count, f"Sending to {to_email} ({sent_count}/{total_count})...")

            # Validate credentials
            if not gmail_user or not gmail_app_password:
                conn.execute("UPDATE schedule SET status='Failed', notes='Missing SMTP credentials in settings.' WHERE id=?", (row_id,))
                conn.commit()
                continue

            resolved_step = stage_step
            if stage_step == "initial":
                t_type = str(target_type_val or "HR").strip().lower()
                resolved_step = "initial_hr" if "hr" in t_type else "initial_non_hr"

            template_key = f"{user_id}_{campaign_id}_{resolved_step}"
            if template_key not in templates_cache:
                t_row = conn.execute("""
                    SELECT subject, body FROM templates 
                    WHERE user_id = ? AND campaign_id = ? AND step_key = ?
                """, (user_id, campaign_id, resolved_step)).fetchone()
                if t_row:
                    templates_cache[template_key] = (t_row["subject"], t_row["body"])
                else:
                    templates_cache[template_key] = None

            template_data = templates_cache[template_key]
            if not template_data:
                conn.execute("UPDATE schedule SET status='Failed', notes='Template not found for this step.' WHERE id=?", (row_id,))
                conn.commit()
                continue

            subject_template, body_template = template_data

            role_type_str = "Summer Internship" if "intern" in str(role).lower() else "Full-Time Role"

            # Render variables with aliases for case-insensitivity and alternative naming conventions
            data_bindings = {
                "FirstName": first_name or "",
                "name": first_name or "",
                "first_name": first_name or "",
                "Company": company or "",
                "company": company or "",
                "RoleType": role_type_str,
                "role_type": role_type_str,
                "role": role_type_str,
                "Division": c1 or "",
                "division": c1 or "",
                "Custom1": c1 or "",
                "custom1": c1 or "",
                "Custom2": c2 or "",
                "custom2": c2 or "",
                "SenderName": sender_name or "Varun Bhardwaj",
                "sender_name": sender_name or "Varun Bhardwaj",
                "SenderPhone": sender_phone or "",
                "sender_phone": sender_phone or "",
            }
            
            subject = render_template(subject_template, data_bindings)
            body = render_template(body_template, data_bindings)

            is_html_format = body.strip().startswith("<") or "</div>" in body or "</p>" in body or "<br" in body
            if is_html_format:
                row_settings = conn.execute("SELECT public_url FROM settings WHERE user_id = ?", (user_id,)).fetchone()
                public_url_val = row_settings["public_url"] if row_settings and row_settings["public_url"] else "http://127.0.0.1:8001"
                body = inject_tracking(body, public_url_val, row_id)

            # CV / Attachments are attached on the INITIAL stage
            attach_path, attach_name = "", ""
            if stage_step == "initial":
                attach_path, attach_name = get_campaign_attachment(conn, user_id, campaign_id)

            # Send SMTP Email
            ok, msg = send_email_smtp(
                gmail_user=gmail_user,
                gmail_app_password=gmail_app_password,
                to_email=to_email,
                subject=subject,
                body=body,
                from_name=sender_name or "Varun Bhardwaj",
                attachment_path=attach_path,
                attachment_name=attach_name
            )

            # Update Database
            status_val = "Sent" if ok else "Failed"
            sent_ts = datetime.now().isoformat()
            conn.execute("""
                UPDATE schedule 
                SET status = ?, last_sent_at = ?, notes = ? 
                WHERE id = ?
            """, (status_val, sent_ts, msg, row_id))
            conn.commit()
            
            # Sync to applications tracker if sent successfully
            if ok and stage_step == "initial":
                try:
                    conn.execute("""
                        INSERT INTO applications (user_id, company, role, role_type, division, contact_name, contact_email, status, notes, last_updated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'Applied', 'Initial cold outreach sent.', ?)
                    """, (user_id, company, "Role in " + (c1 or "Team"), role_type_str, c1, first_name, to_email, sent_ts))
                    conn.commit()
                except Exception as tracker_ex:
                    print(f"[Worker] Error syncing to tracker: {tracker_ex}")

            print(f"[Worker] User {user_id} | Campaign {campaign_id} | Sent to {to_email} | Result: {msg}")

            if sent_count < total_count:
                time.sleep(1.5)

        else:
            # Loop finished normally without break
            set_user_sending_state(user_id, False, sent_count, total_count, f"Batch complete! Successfully processed {sent_count} emails.")

    except Exception as ex:
        err_msg = f"Error during sending: {str(ex)}"
        print(f"[Worker] {err_msg}")
        set_user_sending_state(user_id, False, sent_count, total_count, err_msg)
    finally:
        conn.close()

def start_sending_thread(user_id: int):
    # Runs the process_due_emails function in a separate background thread
    state = get_user_sending_state(user_id)
    if state["is_sending"]:
        return False # Already sending

    t = threading.Thread(target=process_due_emails, args=(user_id,), daemon=True)
    t.start()
    return True

def sync_user_replies(user_id: int) -> dict:
    conn = get_db()
    try:
        settings = conn.execute("""
            SELECT gmail_user, gmail_app_password FROM settings WHERE user_id = ?
        """, (user_id,)).fetchone()
        
        if not settings or not settings["gmail_user"] or not settings["gmail_app_password"]:
            return {"status": "error", "message": "SMTP/Gmail credentials not configured in settings."}
            
        gmail_user = settings["gmail_user"].strip()
        gmail_pass = settings["gmail_app_password"].strip()
        
        rows = conn.execute("""
            SELECT DISTINCT email FROM schedule 
            WHERE user_id = ? AND status = 'Sent'
        """, (user_id,)).fetchall()
        
        sent_emails = [r["email"].strip().lower() for r in rows]
        if not sent_emails:
            return {"status": "success", "message": "No active 'Sent' leads in the queue to check replies for."}
            
        try:
            imap = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=15)
            imap.login(gmail_user, gmail_pass)
        except Exception as e:
            return {"status": "error", "message": f"IMAP authentication failed: {str(e)}"}
            
        imap.select("INBOX")
        
        replied_count = 0
        for target_email in sent_emails:
            status, messages = imap.search(None, f'FROM "{target_email}"')
            if status == "OK" and messages[0]:
                conn.execute("""
                    UPDATE schedule 
                    SET status = 'Replied', notes = 'Auto-detected reply via Gmail Inbox Tracker'
                    WHERE user_id = ? AND email = ?
                """, (user_id, target_email))
                
                # Also update corresponding tracking in application board!
                conn.execute("""
                    UPDATE applications 
                    SET status = 'Interviewing', notes = 'Lead replied. Check your Gmail inbox!'
                    WHERE user_id = ? AND contact_email = ? AND status = 'Applied'
                """, (user_id, target_email))
                
                replied_count += 1
                
        conn.commit()
        imap.logout()
        
        if replied_count > 0:
            return {"status": "success", "message": f"Synced! Auto-detected replies from {replied_count} leads, halted outbox, and updated Kanban cards!"}
        else:
            return {"status": "success", "message": "Synced! Checked inbox, but no new replies were found."}
            
    except Exception as e:
        return {"status": "error", "message": f"Inbox sync encountered an error: {str(e)}"}
    finally:
        conn.close()
