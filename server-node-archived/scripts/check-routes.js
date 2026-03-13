#!/usr/bin/env node

/**
 * Script to check the routes mounted in the server
 * 
 * This script provides a visual representation of all mounted routes
 * with their paths, methods, and middleware.
 */
const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Find the server.ts file by searching the directory
async function findServerFile() {
  const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
  if (fs.existsSync(serverPath)) {
    return serverPath;
  }
  
  // If the file is not at the expected location, try to find it
  try {
    const { stdout } = await exec('find .. -name server.ts');
    const lines = stdout.trim().split('\n');
    if (lines.length > 0) {
      return lines[0];
    }
  } catch (error) {
    console.error('Error finding server.ts:', error.message);
  }
  
  return null;
}

// Parse the server file to extract routes
async function extractRoutes(serverFilePath) {
  if (!serverFilePath) {
    return 'Could not find server.ts file';
  }
  
  try {
    const content = fs.readFileSync(serverFilePath, 'utf8');
    const lines = content.split('\n');
    
    const routes = [];
    let currentLine = 0;
    
    // Extract app.use() statements
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      if (line.includes('app.use(') || line.match(/app\.(get|post|put|delete|patch)\(/)) {
        let route = line.trim();
        
        // Extract path and middleware info
        if (route.includes('/api/')) {
          const pathMatch = route.match(/'([^']+)'|"([^"]+)"/);
          const path = pathMatch ? (pathMatch[1] || pathMatch[2]) : 'unknown';
          
          const middlewareMatch = route.match(/,\s*([^)]+)/);
          const middleware = middlewareMatch ? middlewareMatch[1].trim() : 'unknown';
          
          routes.push({
            path,
            middleware,
            line: currentLine + 1,
            code: route
          });
        }
      }
      currentLine++;
    }
    
    return routes;
  } catch (error) {
    return `Error reading server file: ${error.message}`;
  }
}

// Extract route-specific controllers and middleware
async function findRouteImplementations(routes) {
  const routeFiles = {};
  
  for (const route of routes) {
    if (typeof route !== 'object') continue;
    
    // Extract the route name (e.g., deviceAuthRoutes)
    const routeNameMatch = route.middleware.match(/([a-zA-Z]+Routes)/);
    if (routeNameMatch) {
      const routeName = routeNameMatch[1];
      
      try {
        // Try to find the route file
        const { stdout } = await exec(`find .. -name "*${routeName.replace('Routes', '')}*.ts"`);
        const files = stdout.trim().split('\n');
        
        for (const file of files) {
          if (file.includes('/routes/')) {
            routeFiles[routeName] = file;
            break;
          }
        }
      } catch (error) {
        console.error(`Error finding route file for ${routeName}:`, error.message);
      }
    }
  }
  
  return routeFiles;
}

// Check if a controller exists for a route
async function checkControllers(routeFiles) {
  const controllerInfo = {};
  
  for (const [routeName, routeFile] of Object.entries(routeFiles)) {
    // Extract controller name from route name (e.g., deviceAuth from deviceAuthRoutes)
    const controllerName = routeName.replace('Routes', 'Controller');
    
    try {
      // See if the controller file exists
      const { stdout } = await exec(`find .. -name "${controllerName}.ts"`);
      const controllerFiles = stdout.trim().split('\n');
      
      if (controllerFiles.length > 0 && controllerFiles[0]) {
        controllerInfo[routeName] = {
          controllerFile: controllerFiles[0],
          exists: true
        };
      } else {
        controllerInfo[routeName] = {
          exists: false
        };
      }
    } catch (error) {
      controllerInfo[routeName] = {
        exists: false,
        error: error.message
      };
    }
  }
  
  return controllerInfo;
}

// Check the middlewares used in the app
async function checkMiddlewares() {
  try {
    const { stdout } = await exec('find .. -name "*Middleware.ts"');
    return stdout.trim().split('\n').filter(f => f);
  } catch (error) {
    return [];
  }
}

// Main function
async function main() {
  console.log('Checking server routing configuration...\n');
  
  // Find the server file
  const serverFile = await findServerFile();
  if (!serverFile) {
    console.error('Could not find server.ts file');
    return;
  }
  
  console.log(`Server file found at: ${serverFile}\n`);
  
  // Extract routes
  const routes = await extractRoutes(serverFile);
  
  if (typeof routes === 'string') {
    console.error(routes);
    return;
  }
  
  console.log('API Routes:');
  routes.forEach(route => {
    console.log(`- ${route.path}: ${route.middleware}`);
  });
  
  // Find route implementations
  console.log('\nRoute Files:');
  const routeFiles = await findRouteImplementations(routes);
  for (const [routeName, filePath] of Object.entries(routeFiles)) {
    console.log(`- ${routeName}: ${filePath}`);
  }
  
  // Check controllers
  console.log('\nControllers:');
  const controllerInfo = await checkControllers(routeFiles);
  for (const [routeName, info] of Object.entries(controllerInfo)) {
    if (info.exists) {
      console.log(`- ${routeName} → Controller: ${info.controllerFile}`);
    } else {
      console.log(`- ${routeName} → Controller: NOT FOUND`);
    }
  }
  
  // Check middlewares
  console.log('\nMiddlewares:');
  const middlewares = await checkMiddlewares();
  middlewares.forEach(middleware => {
    console.log(`- ${middleware}`);
  });
  
  console.log('\nRun "ps aux | grep node" to check if the server is running with the latest code.');
  console.log('You may need to restart the server to apply changes.');
}

main().catch(error => {
  console.error('Error:', error);
});