#!/usr/bin/env node

// use node's built in https module to make requests
const https = require('https');

// Define global variables
let lastLog;
let lineTimeout;
let lines;
let resourceLength;
let lastByte;
let buf;

const { stdin } = process;
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

const logLines = (line) => {
  if (line > lines.length) {
    process.exit();
  }

  console.log(line, ' :', lines[line]);
  lastLog = Date.now();
  lineNo = line;

  lineTimeout = setTimeout(() => {
    logLines.call(this, line + 1);
  }, cadence);
};

const logBytes = (byte, current = []) => {
  if (paused === true) {
    return;
  }

  if (byte > resourceLength) {
    console.log(current.join(' ').replace(/\s{2,20}/g, ' '));
    process.exit();
  }

  if (byte % 16 === 0) {
    current.push(buf.toString('ascii', byte - 1, byte));
    console.log(current.join(' ').replace(/\s{2,20}/g, ' '));
    lastLog = Date.now();
    lastByte = byte;

    lineTimeout = setTimeout(() => {
      logBytes(byte + 1);
    }, cadence);
  } else if (byte % 16 === 1) {
    // If the current byte is the start of a new line
    // Get the hex offset and add it to the upcoming line
    const hexString = (byte - 1).toString(16);
    current.push(hexString);
    current.push(':');
    // Add the current byte
    current.push(buf.toString('ascii', byte - 1, byte));

    // Recursively call the function to
    logBytes(byte + 1, current);
  } else {
    // Push the current byte to the upcoming line
    current.push(buf.toString('ascii', byte - 1, byte));
    // Recursively call the function to add the next byte to current
    logBytes(byte + 1, current);
  }
};

stdin.on('data', (key) => {
  // ctrl+c to exit the process
  if (key === '\u0003') {
    process.exit();
  }
  // Define variables to track the progress of the printing
  let position;
  let callback;

  try {
    // Determin whether printing text or bytes and
    // set variables to resume accordingly
    if (buf === undefined) {
      callback = logLines;
      position = lineNo;
    } else {
      callback = logBytes;
      position = lastByte;
    }

    // If the timeout has not been set yet then still waiting for the get request
    if (lineTimeout === undefined) {
      console.log('Still fetching your resource');
    }

    // If space bar is pressed, pause or resume accordingly
    if (key === ' ') {
      if (!paused) {
        // If process is not paused, clear the current timeout
        clearTimeout(lineTimeout);
        paused = true;
      } else {
        // If process is paused, call the necessary logging function
        paused = false;
        callback(position + 1);
      }
    }

    // If - or + keys are pressed, clear the timeout, increase the cadence
    // and restart the timeout with the time left
    if (key === '-') {
      clearTimeout(lineTimeout);
      // Restart process if currently paused
      paused = false;
      cadence += 100;
      // The amount of time left is the new cadence minus the time elapsed since the last log
      let left = cadence - (Date.now() - lastLog);
      // Ensure the time left is not negative
      left = left > 0 ? left : 0;

      lineTimeout = setTimeout(() => {
        callback(position + 1);
      }, left);
    } else if (key === '+' || key === '=') {
      clearTimeout(lineTimeout);
      paused = false;
      cadence -= 100;
      let left = cadence - (Date.now() - lastLog);
      // Ensure the time left is not negative
      left = left > 0 ? left : 0;

      lineTimeout = setTimeout(() => {
        callback(position + 1);
      }, left);
    }
  } catch (err) {
    // Catch errors and allow process to continue
    console.log('Please wait while we fetch your resource');
  }
});

try {
  https.get(process.argv[2], (res) => {
    const data = [];

    const content = res.headers['content-type'] || 'unknown';

    res.on('data', (chunk) => {
      // console.log(line, '--->', chunk);
      data.push(chunk);
    });

    res.on('end', () => {
      if (content.includes('text')) {
        resource = Buffer.concat(data).toString();
        lines = resource.split('\n');
        logLines(1);
      } else if (content.includes('json')) {
        resource = JSON.parse(Buffer.concat(data).toString());
        resourceLength = (new TextEncoder().encode(resource)).length;
        buf = Buffer.concat(data);
        logBytes(1);
      } else {
        resource = Buffer.concat(data).toString();
        resourceLength = (new TextEncoder().encode(resource)).length;
        buf = Buffer.concat(data);
        logBytes(1);
      }
    });
  });
} catch (err) {
  console.log('Unable to fetch resource \n Usage: url [url] \n', err);
  process.exit();
}
