import subprocess
import time
import sys
import os
import signal
import select
import tty
import termios
from urllib.request import urlopen, Request
from urllib.error import URLError

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.align import Align
    from rich.table import Table
    from rich.status import Status
    from rich.text import Text
except ImportError:
    print("Error: 'rich' library is required. Please install it with: pip install rich")
    sys.exit(1)

console = Console()

def is_backend_healthy(url="http://localhost:6671/health", retries=10, delay=1):
    """Check if the backend is responding."""
    for _ in range(retries):
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return True
        except (URLError, ConnectionResetError):
            pass
        time.sleep(delay)
    return False

def start_process(command, cwd, log_name):
    """Starts a subprocess and redirects output to a log file."""
    log_file = open(log_name, "w")
    process = subprocess.Popen(
        command, 
        cwd=cwd, 
        shell=True, 
        stdout=log_file, 
        stderr=log_file,
        preexec_fn=os.setsid # Create a new process group for easier cleanup
    )
    return process, log_file

def print_log_tail(service_name, log_file, lines=25):
    """Reads and prints the last few lines of a log file."""
    try:
        if not os.path.exists(log_file):
             console.print(f"[bold red]Log file not found:[/bold red] {log_file}")
             return

        with open(log_file, 'r') as f:
            # Read all lines (efficient enough for dev logs) and take the tail
            content = f.readlines()
            tail = content[-lines:]
            log_text = "".join(tail) if tail else "[dim italic]No logs yet...[/dim italic]"
            
        console.print(Panel(
            Text(log_text, style="white"),
            title=f"[bold cyan]Recent Logs: {service_name}[/bold cyan] ({log_file})",
            subtitle="Press 1-4 to refresh this view",
            border_style="cyan",
            title_align="left"
        ))
    except Exception as e:
        console.print(f"[bold red]Error reading log {log_file}:[/bold red] {e}")

def main():
    # Header
    console.print(Panel.fit(
        "[bold magenta]🚀 Eldorado AI Project Launcher 🚀[/bold magenta]", 
        subtitle="One-Click Startup",
        border_style="magenta"
    ))

    processes = []
    log_files = []
    
    # Save terminal settings to restore later
    old_settings = termios.tcgetattr(sys.stdin)

    try:
        with console.status("[bold cyan]Initializing services...[/bold cyan]") as status:
            
            # 1. Start Backend
            status.update("[bold yellow]Starting Backend API (FastAPI)...[/bold yellow]")
            backend_cmd = f"{sys.executable} -m uvicorn main:app --reload --host 0.0.0.0 --port 6671"
            backend_proc, backend_log = start_process(backend_cmd, "backend", "backend.log")
            processes.append(backend_proc)
            log_files.append(backend_log)
            
            # Wait for Backend to be healthy
            status.update("[bold yellow]Waiting for Backend to respond...[/bold yellow]")
            if is_backend_healthy():
                console.print("[green]✔ Backend API connected normal[/green] -> [link=http://localhost:6671]http://localhost:6671[/link]")
            else:
                console.print("[bold red]✘ Backend failed to respond![/bold red] Check backend.log")

            # 2. Start Admin Panel (BackFrontend)
            status.update("[bold yellow]Starting Admin Panel...[/bold yellow]")
            admin_cmd = "npm run dev -- --port 6672"
            admin_proc, admin_log = start_process(admin_cmd, "BackFrontend", "admin_frontend.log")
            processes.append(admin_proc)
            log_files.append(admin_log)
            time.sleep(2) # Give Vite a moment
            console.print("[green]✔ Admin Panel (BackFrontend) started[/green] -> [link=http://localhost:6672]http://localhost:6672[/link]")

            # 3. Start Frontend Client
            status.update("[bold yellow]Starting Frontend Client...[/bold yellow]")
            client_cmd = "npm run dev -- --port 6673"
            client_proc, client_log = start_process(client_cmd, "frontend_client", "client_frontend.log")
            processes.append(client_proc)
            log_files.append(client_log)
            time.sleep(2) # Give Vite a moment
            console.print("[green]✔ Frontend Client started[/green] -> [link=http://localhost:6673]http://localhost:6673[/link]")

            # 4. Start Scraper Service (brainrotBB)
            status.update("[bold yellow]Starting Scraper Service (brainrotBB)...[/bold yellow]")
            scraper_cmd = f"{sys.executable} -m uvicorn app:app --reload --host 0.0.0.0 --port 6674"
            scraper_proc, scraper_log = start_process(scraper_cmd, "brainrotBB", "scraper_service.log")
            processes.append(scraper_proc)
            log_files.append(scraper_log)

            # Wait for Scraper to be healthy
            status.update("[bold yellow]Waiting for Scraper Service to respond...[/bold yellow]")
            if is_backend_healthy("http://localhost:6674/"):
                 console.print("[green]✔ Scraper Service connected normal[/green] -> [link=http://localhost:6674]http://localhost:6674[/link]")
            else:
                 console.print("[bold red]✘ Scraper Service failed to respond![/bold red] Check scraper_service.log")

            # 5. Start Backend API Node (Eldorado Offer API)
            status.update("[bold yellow]Starting Node Backend API...[/bold yellow]")
            node_backend_cmd = "npm start"
            node_backend_proc, node_backend_log = start_process(node_backend_cmd, "backend_api", "node_backend.log")
            processes.append(node_backend_proc)
            log_files.append(node_backend_log)
            # Simple wait since it might not have a health endpoint by default
            time.sleep(2)
            console.print("[green]✔ Node Backend API started[/green] -> [link=http://localhost:6675]http://localhost:6675[/link]")

        # Summary Table
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Key", style="bold yellow", justify="center")
        table.add_column("Service", style="dim")
        table.add_column("Status", justify="center")
        table.add_column("URL")
        table.add_column("Log File")

        table.add_row("1", "Backend API", "[green]Running[/green]", "http://localhost:6671", "backend.log")
        table.add_row("2", "Admin Panel", "[green]Running[/green]", "http://localhost:6672", "admin_frontend.log")
        table.add_row("3", "Frontend Client", "[green]Running[/green]", "http://localhost:6673", "client_frontend.log")
        table.add_row("4", "Scraper Service", "[green]Running[/green]", "http://localhost:6674", "scraper_service.log")
        table.add_row("5", "Node Backend API", "[green]Running[/green]", "http://localhost:6675", "node_backend.log")

        console.print(Align.center(table))
        console.print("\n[bold]Controls:[/bold] Press [bold yellow]1, 2, 3, 4, 5[/bold yellow] to view logs. Press [bold red]q[/bold red] or [bold red]Ctrl+C[/bold red] to exit.")

        # Set terminal to cbreak mode (read single keypress without enter)
        tty.setcbreak(sys.stdin.fileno())

        while True:
            # Non-blocking check for input
            if select.select([sys.stdin], [], [], 0.1)[0]:
                key = sys.stdin.read(1)
                
                if key in ['1', '2', '3', '4', '5']:
                    # Temporarily restore terminal to normal to print nicely (handle newlines correctly)
                    termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
                    
                    console.print() # Spacer
                    if key == '1': print_log_tail("Backend API", "backend.log")
                    elif key == '2': print_log_tail("Admin Panel", "admin_frontend.log")
                    elif key == '3': print_log_tail("Frontend Client", "client_frontend.log")
                    elif key == '4': print_log_tail("Scraper Service", "scraper_service.log")
                    elif key == '5': print_log_tail("Node Backend API", "node_backend.log")
                    
                    console.print("[dim]Press 1-5 again to view logs, q to quit...[/dim]")
                    
                    # Back to cbreak mode
                    tty.setcbreak(sys.stdin.fileno())

                elif key.lower() == 'q':
                    raise KeyboardInterrupt

    except KeyboardInterrupt:
        # Restore terminal settings immediately on exit attempt
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
        console.print("\n[bold yellow]Shutting down services...[/bold yellow]")
    except Exception as e:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
        console.print(f"\n[bold red]An error occurred: {e}[/bold red]")
    finally:
        # Restore terminal settings just in case
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
        
        # Cleanup processes
        for p in processes:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM) # Kill the process group
            except Exception:
                pass
        for f in log_files:
            f.close()
        console.print("[bold green]All services stopped. Goodbye![/bold green]")

if __name__ == "__main__":
    main()
