const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '../src')

function traverse(currentDir) {
    const files = fs.readdirSync(currentDir)
    for (const file of files) {
        const fullPath = path.join(currentDir, file)
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath)
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8')
            if (content.includes('formatCOP')) {
                content = content.replace(/formatCOP/g, 'format_currency')
                fs.writeFileSync(fullPath, content, 'utf8')
                console.log(`Updated ${fullPath}`)
            }
        }
    }
}
traverse(dir)
