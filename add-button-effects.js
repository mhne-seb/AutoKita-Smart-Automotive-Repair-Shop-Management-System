const fs = require('fs');
const path = require('path');

const targetClasses = 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0';
const hoverShadow = 'hover:shadow-md';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We want to target: className="..." or className={`...`}
  // For <button> and <a> and <Link> tags.
  // Actually, we can just look for className=" inside <button ... > tags.
  
  // A regex to find button or Link elements and inject into className
  // It's tricky to parse JSX with regex. 
  // Let's just find any `className="` that's immediately preceded by something that looks like a button or link? No, `className` could be anywhere in the tag.

  // Let's use a simpler approach: 
  // Split by `<button` and `<a ` and `<Link `
  const tagsToProcess = ['<button', '<a ', '<Link'];
  
  for (const tag of tagsToProcess) {
    let parts = content.split(tag);
    for (let i = 1; i < parts.length; i++) {
      // parts[i] starts right after the tag name.
      // Find the end of the opening tag '>'
      let endOfTag = -1;
      let inQuotes = false;
      let inBraces = 0;
      for (let j = 0; j < parts[i].length; j++) {
        const c = parts[i][j];
        if (c === '"' || c === "'") {
          inQuotes = !inQuotes;
        } else if (c === '{') {
          inBraces++;
        } else if (c === '}') {
          inBraces--;
        } else if (c === '>' && !inQuotes && inBraces === 0) {
          endOfTag = j;
          break;
        }
      }

      if (endOfTag !== -1) {
        let tagContent = parts[i].substring(0, endOfTag);
        
        // Skip if already has cursor-pointer
        if (!tagContent.includes('cursor-pointer') && !tagContent.includes('disabled')) {
          // Let's add our classes.
          // Is there a className=" ?
          const classStrMatch = tagContent.match(/className="([^"]+)"/);
          if (classStrMatch) {
             const newClasses = classStrMatch[1] + " " + targetClasses + " " + hoverShadow;
             tagContent = tagContent.replace(/className="([^"]+)"/, `className="${newClasses}"`);
          } else {
             const classExprMatch = tagContent.match(/className=\{`([^`]+)`\}/);
             if (classExprMatch) {
               const newClasses = classExprMatch[1] + " " + targetClasses + " " + hoverShadow;
               tagContent = tagContent.replace(/className=\{`([^`]+)`\}/, `className={\`${newClasses}\`}`);
             } else {
               // No className? Add one
               tagContent += ` className="${targetClasses} ${hoverShadow}"`;
             }
          }
        }
        parts[i] = tagContent + parts[i].substring(endOfTag);
      }
    }
    content = parts.join(tag);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'app', '(admin)'));
