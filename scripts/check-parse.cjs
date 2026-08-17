
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');
const fs=require('fs');
const files=process.argv.slice(2);
let bad=0;
for(const f of files){
 const src=fs.readFileSync(f,'utf8');
 const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,f.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length){bad++;console.log(f);for(const d of sf.parseDiagnostics)console.log(ts.flattenDiagnosticMessageText(d.messageText,' '));}
}
process.exit(bad?1:0);
