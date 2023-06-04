#!/usr/bin/env node

// use node's built in https module to make requests
const https = require('https');

var stdin = process.stdin;
// ensure stream is received before enter is pressed
stdin.setRawMode(true);

// Dont exit process until done
stdin.resume();
// handle binary inputs
stdin.setEncoding('utf8');

let resource;
let cadence = 1000;
let lineNo = 1;
let paused = false;
global.lastLog;
global.lineTimeout;
global.lines;

const logLines = (line) => {
  if (line > lines.length) {
    process.exit();
  }

  console.log(line, ':', lines[line]);
  lastLog = Date.now();
  lineNo = line;

  lineTimeout = setTimeout(() => {
    logLines.call(this, line + 1);
  }, cadence);
}

stdin.on('data', (key) => {
  // ctrl+c to exit
  if (key === '\u0003') {
    process.exit();
  }

  if (global.lineTimeout === 'undefined') {
    console.log('Still fetching your resource');
  }

  if (key === ' ') {
    if (!paused) {
      clearTimeout(lineTimeout);
      paused = true;
    } else {
      paused = false;
      logLines(lineNo + 1);
    }

  }

  if (key === '-') {
    clearTimeout(lineTimeout);
    cadence += 100;
    let left = cadence - (Date.now() - lastLog);
    lineTimeout = setTimeout(() => {
      logLines.call(this, lineNo + 1);
    }, left);
  }

  if (key === '+' || key === '=') {
    clearTimeout(lineTimeout);
    cadence -= 100;
    let left = cadence - (Date.now() - lastLog);
    lineTimeout = setTimeout(() => {
      logLines.call(this, lineNo + 1);
    }, left);
  }
});


try{
  https.get(process.argv[2], (res) => {
    let data = [];

    let content = res.headers['content-type'] || 'unknown';

    res.on('data', chunk => {
      //console.log(line, '--->', chunk);
      data.push(chunk)
    });

    res.on('end', () => {
      if (content.includes('text/plain')) {
        resource = Buffer.concat(data).toString();
        lines = resource.split('\n');
        logLines(1);
      } else if (content.includes('json')) {
        resource = JSON.parse(Buffer.concat(data).toString());
        var buf = new Buffer(data);
        var short_name = buf.toString('ascii', 0, 16);
        var name = buf.toString('ascii', 16, 32);
        console.log(short_name, name)
      } else {
        resource = Buffer.concat(data).toString('ascii', 0, 10);

        console.log(resource)
      }

    });
  });
} catch (err) {
  console.log('Unable to fetch resource \n Usage: url [url] \n', err);
  process.exit();
}
