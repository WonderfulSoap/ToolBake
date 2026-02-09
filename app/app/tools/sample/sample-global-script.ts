
export const sampleGlobalScriptSourceCode = `
/**
 * Here is the Gblobal Script.
 * How this global script works: The system concatenates this global script before the handler code to be executed, and runs it prior to executing the tool handler.
 **/


// A sample sleep function that can be used in tool handlers
// how to use in handler: just use it normally 'await sleep(1000);'
async function sleep(ms){
  return new Promise((resolve) => setTimeout(resolve, ms));
}

`;