# syntgrid

I was tired of asking my uni friends what they had and when their lunch break was, so I built syntgrid, which allows you to download your Outlook calendar and share it here. It also has a system for planning your week using your LLM; it also takes into account your todos through **trellis**. I use this as my scheduling application, check it out at https://syntgrid.vercel.app 

A full-stack intelligent scheduling and calendar-sharing platform built for university students, powered by Next.js, Prisma, MongoDB, and an LLM scheduling pipeline.

## Check it out

Live at https://syntgrid.vercel.app

## Overview

`syntgrid` streamlines how students organise coursework, lectures, and society commitments. Beyond synchronising and sharing university timetables, it integrates an AI scheduling pipeline that parses natural-language instructions and constraints into structured calendar events, automatically resolving conflicts across shared schedules.

## Key Features

- **Natural-Language AI Scheduling:** Describe tasks, deadlines, or recurring study blocks in plain English; the LLM pipeline extracts structured parameters (duration, priority, time bounds) and slots them into open calendar windows.
- **University Timetable Sync & Sharing:** Import `.ics` lecture feeds and share read/write or free/busy availability grids with study groups and project teammates.
- **Conflict Detection & Multi-User Overlays:** Instantly compute overlapping free slots across multiple university calendars for group meetings.
- **Type-Safe Persistence:** Built on Prisma ORM with MongoDB for flexible document storage and strict TypeScript schema validation.

## Tech Stack

- **Framework:** Next.js (App Router, React, TypeScript)
- **Database & ORM:** MongoDB, Prisma
- **AI / LLM Pipeline:** Structured output parsing & constraint-aware slot allocation
- **Styling:** Tailwind CSS

## License

MIT
