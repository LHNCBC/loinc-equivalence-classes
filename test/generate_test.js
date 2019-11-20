const assert = require('assert');
const path = require('path');
const fs = require('fs');
const loincUtil = require('../src/util');

const srcDir = path.join(__dirname, '../src');

describe('generate_all.js', ()=>{
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
    let classDirs = fs.readdirSync(srcDir).filter(
      f=>f.match(/^class_/) && fs.existsSync(path.join(srcDir, f, 'generate_classes.js')));
    classDirs.forEach(cDir=>{
      let loincCls = cDir.slice(6);
      let resultsFile = loincUtil.resultsFilename(loincCls);
      let fStats = fs.statSync(path.join(srcDir, cDir, resultsFile));
      assert.ok(fStats);
      assert.ok(fStats.size > 0);
    });
  });
});

