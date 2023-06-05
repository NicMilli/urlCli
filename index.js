#!/usr/bin/env node

// use node's built in https module to make requests
const https = require('https');

// Define scoped variables
let lastLog;
let lineTimeout;
let lines;
let resourceLength;
let lastByte;
let buf;
let cadence = 1000;
let lineNo = 1;
let paused = false;

const { stdin } = process;
// ensure stream is received before enter is pressed
stdin.setRawMode(true);

// Dont exit process until done
stdin.resume();
// handle binary inputs
stdin.setEncoding('utf8');

const logLines = (line) => {
  // exit once all lines have been printed
  if (line > lines.length) {
    process.exit();
  }

  // Log the line preceeded by the line number
  console.log(line, ' :', lines[line]);
  // Track the time, so that the rhythm is not broken when accelerating
  // or decelerating cadence
  lastLog = Date.now();
  // Track the line number to resume after pausing
  lineNo = line;

  // Set the next line to be printed after allotted time
  lineTimeout = setTimeout(() => {
    logLines.call(this, line + 1);
  }, cadence);
};

const logBytes = (byte, current = []) => {
  // If program is currently paused, end the recursion
  if (paused === true) {
    return;
  }

  // Log the line if the end of the resource has been reached, exit the process
  if (byte > resourceLength) {
    // Replace carriage returns
    console.log(current.join(' '));
    process.exit();
  }

  // If current byte is a multiple of 16, add to the line and print
  if (byte % 16 === 0) {
    current.push(buf.toString('ascii', byte - 1, byte));

    const hexString = (byte - 16).toString(16);
    // ensure carriage return doesn't delete line no
    console.log(hexString, ':', current.join(' ').replace(/[\n\r]/g, ''));
    lastLog = Date.now();
    lastByte = byte;

    lineTimeout = setTimeout(() => {
      logBytes(byte + 1);
    }, cadence);
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
      // aggregate chunks received into data array
      data.push(chunk);
    });

    res.on('end', () => {
      // If text received
      if (content.includes('text')) {
        lines = Buffer.concat(data).toString().split('\n');
        logLines(1);
      } else {
        buf = Buffer.concat(data);
        resourceLength = (new TextEncoder().encode(buf.toString())).length;
        logBytes(1);
      }
    });
  });
} catch (err) {
  console.log('Unable to fetch resource \n Usage: url [url] \n', err);
  process.exit();
}
