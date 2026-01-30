#!/bin/bash
set -e
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev &
echo "Setup complete. Next.js is starting in the background."
