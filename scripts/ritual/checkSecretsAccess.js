const { ethers, SECRETS_AC, secretsAbi } = require('./_config');
async function main(){ const owner=process.env.SECRET_OWNER; const delegate=process.env.SECRET_DELEGATE; const hash=process.env.SECRETS_HASH; if(!owner||!delegate||!hash) throw new Error('Set SECRET_OWNER, SECRET_DELEGATE, SECRETS_HASH'); const c=await ethers.getContractAt(secretsAbi, SECRETS_AC); const [ok, policy]=await c.checkAccess(owner, delegate, hash); console.log(JSON.stringify({owner,delegate,hash,hasAccess:ok,policy},null,2)); }
main().catch((e)=>{ console.error(e); process.exit(1); });
