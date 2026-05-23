<p align="center">
  <img width="300" align="center" src=".github/logo.webp">
  <br>
  <div align="center">
    <img alt="Visitor Badge" src="https://api.visitorbadge.io/api/visitors?path=https://github.com/gokulvasanthgv/GoHoot/edit/main/README.md&countColor=%23FF9900">
  </div>
</p>

## 🧩 What is this project?

GoHoot is a straightforward and open-source quiz platform, allowing users to host it on their own server for smaller events.

> [!CAUTION]
> **100% VIBECODED! Use at your own risk.**
> GoHoot is built on top of [Razzia](https://github.com/Ralex91/Razzia) by adding highly customized visual enhancements, persistent session mechanics, and gameplay configurations. It is essentially forked from Razzia. Feel free to use it, but expect things to work based entirely on vibes!

> **Disclaimer**: GoHoot is an independent, open-source software project. It is not affiliated with, endorsed by, or sponsored by any third-party quiz platform or service. Any resemblance to other quiz platforms is purely incidental.

<p align="center">
  <img width="30%" src=".github/previews/1.png" alt="Login">
  <img width="30%" src=".github/previews/2.png" alt="Manager Room">
  <img width="30%" src=".github/previews/3.png" alt="Question Screen">
</p>

## 🚀 Key Features (Compared to Razzia)

GoHoot enhances the original Razzia platform with the following major upgrades:

- **⚙️ Extensive Pre-Game Options**: Configure classic or accuracy scoring modes, shuffle option orders, and set questions/options to be hidden on player devices.
- **🧩 Interactive Touch Drag-and-Drop Puzzles**: Support for ordering-type questions. Players can slide options into the correct chronological or rank order using a smooth, responsive touch drag interface (powered by `@hello-pangea/dnd`).
- **📱 Responsive Layouts & Presenter Views**: Confined screen layouts that scale dynamically and prevent content overflow on the manager presentation screens. Features larger, high-visibility typography, automatic left/right column splits based on image aspect ratio, and dynamic font resizing for long questions.
- **🔄 Session Reconnection**: Fully persistent player and manager connections via `localStorage` and backup cookie sessions. Players can reload the browser, open the browser app later, or lose connection, and automatically rejoin their active game state without losing points or re-entering details.
- **📊 Extended Excel Results Exporter**: Export game statistics and modes directly into formatted spreadsheet files.

## ⚙️ Prerequisites

Choose one of the following deployment methods:

### Without Docker

- Node.js : version 22 or higher
- PNPM : version 10.16 or higher (learn more [here](https://pnpm.io/))

### With Docker

- Docker and Docker Compose

## 📖 Getting Started

Choose your deployment method:

### 🐳 Using Docker (Recommended)

Using Docker Compose (recommended):
You can find the docker compose configuration in the repository:
[docker-compose.yml](/compose.yml)

```bash
docker compose up -d
```

Or using Docker directly:

```bash
docker run -d \
  -p 3000:3000 \
  -v ./config:/app/config \
  gohoot:latest
```

**Configuration Volume:**
The `-v ./config:/app/config` option mounts a local `config` folder to persist your game settings and quizzes. This allows you to:

- Edit your configuration files directly on your host machine
- Keep your settings when updating the container
- Easily backup your quizzes and game configuration

The folder will be created automatically on first run with an example quiz to get you started.

The application will be available at http://localhost:3000

### 🛠️ Without Docker

1. Clone the repository:

```bash
git clone https://github.com/gokulvasanthgv/GoHoot.git
cd ./GoHoot
```

2. Install dependencies:

```bash
pnpm install
```

3. Build and start the application:

```bash
# Development mode
pnpm run dev

# Production mode
pnpm run build
pnpm start
```

## ⚙️ Configuration

The configuration is split into two main parts:

### 1. Game Configuration (`config/game.json`)

Main game settings:

```json
{
  "managerPassword": "PASSWORD"
}
```

Options:

- `managerPassword`: The master password for accessing the manager interface. **Must be changed from the default `"PASSWORD"` value**, otherwise manager access is blocked.

### 2. Quiz Configuration (`config/quizz/*.json`)

Quizzes can be created in two ways:

- **Via the Quiz Editor** — use the built-in editor available in the manager dashboard (recommended)
- **Via JSON files** — manually create files in the `config/quizz/` directory

You can have multiple quiz files and select which one to use when starting a game.

Example quiz configuration (`config/quizz/example.json`):

```json
{
  "subject": "Example Quiz",
  "questions": [
    {
      "type": "quiz",
      "question": "What is the correct answer?",
      "answers": ["No", "Yes", "No", "No"],
      "solutions": [1],
      "cooldown": 5,
      "time": 15
    },
    {
      "type": "quiz",
      "question": "Which of these are primary colors with a YouTube video?",
      "answers": ["Red", "Green", "Blue", "Yellow"],
      "media": {
        "type": "video",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      },
      "solutions": [0, 2, 3],
      "cooldown": 5,
      "time": 20
    },
    {
      "type": "slide",
      "question": "Welcome to GoHoot!",
      "text": "This is an informational slide. It displays text content side-by-side with optional media.",
      "media": {
        "type": "image",
        "url": "https://placehold.co/600x400.png"
      },
      "cooldown": 5
    },
    {
      "type": "puzzle",
      "question": "Arrange the following numbers from smallest to largest:",
      "answers": ["10", "20", "30", "40"],
      "cooldown": 5,
      "time": 30
    }
  ]
}
```

Quiz Options:

- `subject`: Title/topic of the quiz
- `questions`: Array of question objects containing:
  - `type`: Optional. Question type: `"quiz"` (standard multiple choice, default), `"slide"` (informational presentation slide), or `"puzzle"` (drag-and-drop ordering game)
  - `question`: The question/slide title text
  - `text`: Optional body text (used for `"slide"` type questions)
  - `answers`: Array of possible options (2-4 options for `"quiz"`; up to 7 options for `"puzzle"` to sort)
  - `media`: Optional media object displayed with the question:
    - `type`: `"image"`, `"video"`, or `"audio"`
    - `url`: URL of the media (supports direct file URLs and YouTube video links)
  - `solutions`: Array of correct answer indices (0-based, applicable to `"quiz"` type). Use multiple indices for multi-answer questions. For `"puzzle"` type questions, the correct order is determined by the order of elements defined in the `"answers"` array, so `"solutions"` is not used.
  - `cooldown`: Time in seconds before answers are revealed (3-15)
  - `time`: Time in seconds allowed to answer (5-120)

## 🎮 How to Play

1. Access the manager interface at http://localhost:3000/manager
2. Enter the manager password (defined in `config/game.json`)
3. Share the game URL (http://localhost:3000) and room code with participants
4. Wait for players to join
5. Click the start button to begin the game

