const fs = require('fs')
const path = require('path')
function getFilesRecursive(directory) {
    let results = [];
    
    // Read items in the directory
    const items = fs.readdirSync(directory); 

    for (const item of items) {
        if (item === '.DS_Store') continue;

        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        
        // If it's a directory, recursively get its files
        if (stat.isDirectory()) {
            results = results.concat(getFilesRecursive(itemPath));
        } else {
            let ext = path.extname(itemPath)
            results.push({
              dirName: path.dirname(itemPath),
              pathName: itemPath,
              fileName: path.basename(itemPath, ext)
            });
        }
    }

    return results;
}

module.exports = {
    getFilesRecursive
}