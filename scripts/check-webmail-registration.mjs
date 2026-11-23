import {inspectRegistration} from '../api/webmail-sync.js';
const email=process.argv[2]||process.env.WEBMAILHR_REPAIR_REGISTRATION_EMAIL;
if(!email)process.exit(0);
try{console.log('Webmail registration check',JSON.stringify(await inspectRegistration(email,process.argv.includes('--apply')||email===process.env.WEBMAILHR_REPAIR_REGISTRATION_EMAIL)));}
catch(error){console.error('Webmail registration check',JSON.stringify({status:error.status||503,message:error.status?error.message:'Privremena pogreška povezivanja.'}));process.exitCode=1;}
