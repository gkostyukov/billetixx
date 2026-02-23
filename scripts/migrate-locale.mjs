import fs from 'fs';
import path from 'path';

const appDir = path.join(process.cwd(), 'src', 'app');
const localeDir = path.join(appDir, '[locale]');

if (!fs.existsSync(localeDir)) {
    fs.mkdirSync(localeDir, { recursive: true });
}

const itemsToMove = [
    'auth', 'bank-accounts', 'bills', 'categories', 'credit-cards',
    'dashboard', 'payments', 'trading', 'layout.tsx', 'page.tsx'
];

let success = true;

itemsToMove.forEach(item => {
    const oldPath = path.join(appDir, item);
    const newPath = path.join(localeDir, item);
    if (fs.existsSync(oldPath)) {
        try {
            fs.renameSync(oldPath, newPath);
            console.log(`Successfully moved ${item} to [locale]`);
        } catch (e) {
            console.error(`Failed to move ${item}:`, e.message);
            success = false;
        }
    } else {
        console.warn(`Source not found: ${oldPath}`);
    }
});

if (success) {
    console.log('Migration complete!');
} else {
    console.error('Migration finished with errors.');
    process.exit(1);
}
