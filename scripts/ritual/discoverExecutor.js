const { ethers, TEE_SERVICE_REGISTRY, HTTP_CAPABILITY, registryAbi } = require('./_config');
async function main(){ const c = await ethers.getContractAt(registryAbi, TEE_SERVICE_REGISTRY); const services = await c.getServicesByCapability(HTTP_CAPABILITY, true); console.log(JSON.stringify(services.map(s=>({teeAddress:s.node.teeAddress, publicKey:s.node.publicKey, endpoint:s.node.endpoint, workloadId:s.workloadId, isValid:s.isValid})), null, 2)); }
main().catch((e)=>{ console.error(e); process.exit(1); });
