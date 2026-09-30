const fs = require('fs');

function replaceInFile(file, regex, replacement) {
    if(!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
}

replaceInFile('src/commands/automation/automation.ts', /createTask\(/g, 'await createTask(');
replaceInFile('src/commands/automation/automation.ts', /deleteTask\(/g, 'await deleteTask(');
replaceInFile('src/commands/automation/automation.ts', /const task = getTask\(/g, 'const task = await getTask(');
replaceInFile('src/commands/automation/automation.ts', /const tasks = getTasksForGuild\(/g, 'const tasks = await getTasksForGuild(');
replaceInFile('src/commands/automation/automation.ts', /const currentTasks = getTasksForGuild\(/g, 'const currentTasks = await getTasksForGuild(');

replaceInFile('src/commands/moderation/clearwarnings.ts', /const warnings = getWarningsForUser\(/g, 'const warnings = await getWarningsForUser(');
replaceInFile('src/commands/moderation/warn.ts', /const warnings = getWarningsForUser\(/g, 'const warnings = await getWarningsForUser(');

replaceInFile('src/services/scheduler.ts', /const obj = task\.toObject\(\);/g, 'const obj = task.toObject() as any;');
replaceInFile('src/services/scheduler.ts', /const obj = doc\.toObject\(\);/g, 'const obj = doc.toObject() as any;');

replaceInFile('src/services/schedulerRunner.ts', /task\.id/g, 'task.id!');

replaceInFile('src/main.ts', /import \{ kv \} from "\.\/database\/kv";/g, 'import { connectDatabase, closeDatabase } from "./database/mongo";');
replaceInFile('src/main.ts', /process\.on\("SIGINT", \(\) => \{/, 'process.on("SIGINT", async () => {\n  await closeDatabase();\n');
replaceInFile('src/main.ts', /process\.on\("SIGTERM", \(\) => \{/, 'process.on("SIGTERM", async () => {\n  await closeDatabase();\n');
replaceInFile('src/main.ts', /logger\.info\("Closing database connection\.\.\."\);/, '');

replaceInFile('src/main.ts', /const client = createClient\(\);/, 'await connectDatabase();\n  const client = createClient();');
