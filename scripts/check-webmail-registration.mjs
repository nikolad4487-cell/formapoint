import {inspectRegistration} from '../api/webmail-sync.js';
const email=process.argv[2];
if(!email)throw new Error('Specify the registration address to inspect.');
try{console.log('Webmail registration check',JSON.stringify(await inspectRegistration(email,process.argv.includes('--apply'))));}
catch(error){console.error('Webmail registration check',JSON.stringify({status:error.status||503,message:error.status?error.message:'Privremena pogreška povezivanja.'}));process.exitCode=1;}
