// Generates all of the equivalence class spreadsheets.  (To be run with "node".)

// Find the classes that have the new approach completed, as evidenced by the
// presence of a "generate_classes.js" file.
const fs = require('fs');
const path = require('path');
let classDirs = fs.readdirSync(__dirname).filter(
  f=>f.match(/^class_/) && fs.existsSync(path.join(__dirname, f, 'generate_classes.js')));

console.log(classDirs);

(async function() {
  const util = await require('./util').sqlUtil();
  const {query, closeConnection} = util;

  try {
    // TBD - Implement a script to load the molecular weights table if needed.  Call
    // it here if the table is missing.
    let qRes = await query("IF OBJECT_ID('MOLECULAR_WEIGHTS') IS NOT NULL select 'found'")
    if (!qRes.recordset)
      throw Error('The table MOLECULAR_WEIGHTS is missing.  Please load it from the spreadhseet.');

    // TBD - Implement a script to load the stored procuedures.  Call
    // it here if the proceures are missing.
    qRes = await query("IF OBJECT_ID('dup_column') IS NOT NULL select 'found'")
    if (!qRes.recordset)
      throw Error('The stored procedures are missing.  Please load them from common_t.sql');

    // Run the CHEM generation first.  It shares code with DRUG/TOX and both try
    // to create the same table.
    const cp = require('child_process');
    const util = require('util');
    const exec = util.promisify(cp.exec);
    /*
    await exec('node '+
      path.join(__dirname, 'class_CHEM', 'generate_classes.js')));
    classDirs.
   */
    // At the point, the class-specific routines can run concurrently.
    let genProcs = [];
    classDirs.forEach(d=>genProcs.push(exec('node '+
      path.join(__dirname, d, 'generate_classes.js'))));
    await Promise.all(genProcs).catch(e=>{console.log(e); throw e});
  }
  catch (e) {
    console.error(e);
    process.exit(1); // signal error
    throw e;
  }
  finally {
    await closeConnection();
  }
})();
