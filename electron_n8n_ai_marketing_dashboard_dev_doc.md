# Electron + n8n AI Marketing Dashboard

## Overview

This project is an internal desktop application for a marketing team.

The application allows marketers to:
- Write prompts
- Configure campaign/request settings
- Submit AI requests
- Track request status
- View generated outputs
- View request history/logs

The application communicates with n8n using webhooks.

This is a single-user desktop application.

No authentication system is required.

No approval workflow is required for the current version.

---

# Core Architecture

```text
Electron App
    ↓
Webhook POST
    ↓
n8n Workflow
    ↓
AI Processing
    ↓
Webhook Response
    ↓
Electron UI Update
```

---

# Goals

## Primary Goals

- Very simple UX for marketers
- Modern desktop-app feel
- Fast request submission
- Clear request status
- Beautiful generated output display
- Stable local history/log system
- Easy developer configuration
- Lightweight infrastructure

---

# Tech Stack

## Desktop Framework

- Electron

## Frontend

- HTML
- TailwindCSS
- Vanilla JavaScript

## Local Database

- SQLite

## Backend Automation

- n8n

## AI Providers

Configurable:
- OpenAI
- Gemini
- Claude
- Other providers through n8n

---

# Folder Structure

```text
/app
  /renderer
    index.html
    dashboard.js
    animations.js
    settings.js
    history.js
    styles.css

  /main
    main.js
    preload.js
    database.js
    webhook.js
    config.js

  /database
    app.db

  /assets
    logo.png
    icons/
    animations/

/config
  settings.json
```

---

# UI/UX Direction

## Visual Style

The app should feel like:
- modern SaaS dashboard
- minimal
- smooth
- clean
- slightly futuristic
- professional

Avoid:
- spreadsheet feeling
- enterprise clutter
- overly colorful UI
- old desktop software look

---

# Design Language

## Use:

- rounded cards
- soft shadows
- glassmorphism light effects
- subtle gradients
- smooth transitions
- large readable spacing
- animated hover states
- animated status indicators
- skeleton loaders
- toast notifications

---

# Animation Requirements

Animations must be:
- smooth
- lightweight
- responsive
- subtle
- non-annoying

## Required Animations

### Dashboard Load
- fade in
- slight upward motion

### Submit Button
- hover glow
- click scale animation
- loading spinner while processing

### Status Changes
- smooth color transition
- animated pulse while processing

### AI Result Area
- fade reveal animation
- typing-like progressive appearance

### Sidebar / Panels
- smooth slide animation

### Toast Notifications
- slide in from top-right
- auto-dismiss fade out

---

# Recommended Animation Libraries

## Preferred

- Framer Motion (if React later)
- Anime.js
- Motion One

## Current Recommendation

Use:
- CSS animations
- Motion One

Keep bundle lightweight.

---

# Application Screens

## 1. Dashboard Screen

Main operational screen.

Contains:
- Prompt textarea
- Platform dropdown
- Urgent toggle
- Schedule date picker
- Optional keyword/tag field
- Submit button
- Current status
- Last request snapshot
- AI output viewer

---

## 2. History Screen

Displays previous requests.

Features:
- Search
- Filter by status
- Sort by date
- Re-open previous outputs
- Copy generated result

---

## 3. Advanced Settings Screen

Developer-focused configuration page.

Hidden behind:
- settings icon
- keyboard shortcut
- optional confirmation modal

This screen is NOT intended for marketing users.

---

# Advanced Settings Requirements

## Configurable Fields

### Webhook

- n8n webhook URL
- webhook token
- timeout duration

### AI Settings

- default AI provider
- default model
- temperature
- max tokens

### UI Settings

- dark/light mode
- animation enable/disable
- compact mode

### Database

- database path
- export logs
- clear history

### Debug

- enable debug logs
- verbose mode
- webhook test button

---

# Database Design

## SQLite Tables

### requests

| Field | Type |
|---|---|
| id | INTEGER |
| request_id | TEXT |
| prompt | TEXT |
| keyword | TEXT |
| platform | TEXT |
| urgent | INTEGER |
| schedule_date | TEXT |
| status | TEXT |
| output | TEXT |
| error_message | TEXT |
| created_at | TEXT |
| updated_at | TEXT |

---

## settings

| Field | Type |
|---|---|
| key | TEXT |
| value | TEXT |

---

# Request Lifecycle

## Status Flow

```text
Draft
→ Pending
→ Processing
→ Completed
```

Error flow:

```text
Processing
→ Error
```

---

# Request Submission Flow

## Step 1
User fills dashboard form.

---

## Step 2
User clicks Submit.

---

## Step 3
Frontend validates:
- prompt required
- webhook configured

---

## Step 4
Generate request ID.

Format:

```text
REQ-{timestamp}
```

Example:

```text
REQ-1778639201932
```

---

## Step 5
Save request into SQLite.

Status:

```text
Pending
```

---

## Step 6
Send POST request to n8n webhook.

Payload example:

```json
{
  "request_id": "REQ-1778639201932",
  "prompt": "Create Instagram campaign ideas",
  "keyword": "summer campaign",
  "platform": "Instagram",
  "urgent": true,
  "schedule_date": "2026-05-14"
}
```

---

## Step 7
n8n processes request.

Possible actions:
- AI generation
- SEO generation
- content creation
- image generation
- scheduling
- social posting

---

## Step 8
Electron receives response.

---

## Step 9
Update:
- status
- output
- logs
- dashboard

---

# Dashboard Layout

## Recommended Structure

```text
+------------------------------------------------+
| Sidebar                                        |
|------------------------------------------------|
| Dashboard                                      |
| History                                        |
| Settings                                       |
+------------------------------------------------+

+------------------------------------------------+
| AI Request Form                                |
|------------------------------------------------|
| Prompt textarea                                |
| Platform dropdown                              |
| Urgent toggle                                  |
| Schedule date                                  |
| Keyword field                                  |
|                                                |
| [ Submit Request ]                             |
+------------------------------------------------+

+------------------------------------------------+
| Current Status                                 |
|------------------------------------------------|
| Request ID                                     |
| Processing state                               |
| Last updated                                   |
+------------------------------------------------+

+------------------------------------------------+
| AI Generated Output                            |
|------------------------------------------------|
| Markdown-rendered response                     |
| Copy button                                    |
| Expand button                                  |
+------------------------------------------------+
```

---

# AI Output Requirements

Output area should support:
- markdown rendering
- copy-to-clipboard
- syntax highlighting
- code blocks
- expandable sections
- smooth rendering animation

---

# Error Handling

## Required Error States

### Webhook Offline

Display:

```text
Unable to connect to n8n.
```

---

### AI Failure

Display:

```text
AI processing failed.
```

---

### Invalid Configuration

Display:

```text
Webhook URL missing.
```

---

# Notifications

Use toast notifications.

Examples:

```text
Request submitted successfully
```

```text
AI response completed
```

```text
Webhook connection failed
```

---

# Performance Requirements

## Startup

Target:
- under 3 seconds

---

## UI Interaction

Target:
- smooth 60fps interactions

---

## Memory Usage

Keep lightweight.

Avoid:
- unnecessary libraries
- huge UI frameworks
- excessive animations

---

# Security Notes

## Since this is single-user internal software:

Acceptable:
- local config storage
- local SQLite
- local webhook settings

Still recommended:
- never hardcode secrets
- use environment config where possible
- validate webhook URLs

---

# Future Expansion Possibilities

Potential future modules:

- multi-step AI workflows
- image generation
- video generation
- social media scheduler
- campaign planner
- SEO tools
- analytics dashboard
- template manager
- AI preset system
- prompt library
- team collaboration

---

# Recommended Development Phases

## Phase 1
Core MVP

Includes:
- dashboard
- webhook submission
- SQLite logs
- settings page
- AI response viewer

---

## Phase 2
UX improvements

Includes:
- animations
- markdown rendering
- search/filter history
- notification system

---

## Phase 3
Advanced AI features

Includes:
- templates
- presets
- multiple providers
- scheduling system

---

# Developer Notes

## Important Principles

### Keep UI Simple

Marketing users should never feel overwhelmed.

---

### Avoid Spreadsheet-Like UX

This should feel like:
- modern SaaS tool
- AI assistant app
- internal operations dashboard

NOT:
- admin ERP system
- enterprise form software

---

### Minimize User Decisions

Good defaults are important.

---

### Keep AI Results Beautiful

Output presentation quality matters heavily.

---

# Recommended Libraries

## UI

- TailwindCSS
- Motion One
- Lucide Icons

## Markdown

- marked
- markdown-it

## Database

- better-sqlite3

## Electron Helpers

- electron-store
- electron-builder

---

# Packaging

Target platform:

- Windows

Optional future:
- macOS
- Linux

Use:

- electron-builder

---

# Final Product Vision

The final application should feel like:

```text
An internal AI marketing control center.
```

It should feel:
- modern
- smooth
- responsive
- visually polished
- operationally simple
- reliable
- fast
- easy for non-technical staff

