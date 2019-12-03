const assert = require('assert');
const path = require('path');
const fs = require('fs');
const loincUtil = require('../src/util');

const srcDir = path.join(__dirname, '../src');
const rimraf = require('rimraf');

describe('generate_all.js', ()=>{
  let resultsDir = path.join(__dirname, '../results');

  /**
   *  Returns the class directories for the classes for which a
   *  generate_classes.js program has been implemented.
   */
  function getClassDirs() {
    return fs.readdirSync(srcDir).filter(
      f=>f.match(/^class_/) && fs.existsSync(path.join(srcDir, f, 'generate_classes.js')));
  }

  before(function(done) {
    // Delete the results files.
    rimraf(resultsDir, ()=>done());
  });

  it('should run and exit normally', function(done) {
    this.timeout(60000);
    const cp = require('child_process');
    cp.exec('node '+ path.join(srcDir, 'generate_all.js'), (err, stdout, stderr)=>{
      if (stdout)
        console.log(stdout);
      if (stderr)
        console.log(stderr);
      done(err)
    });
  });

  it('should have generated the results files', function() {
    let classDirs = getClassDirs();
    classDirs.forEach(cDir=>{
      let loincCls = cDir.slice(6);
      let resultsFile = loincUtil.resultsPathname(loincCls);
      let fStats = fs.statSync(resultsFile);
      assert.ok(fStats);
      assert.ok(fStats.size > 0);
    });
  });
});

