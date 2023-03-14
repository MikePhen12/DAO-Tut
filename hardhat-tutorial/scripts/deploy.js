const { CRYPTODEVS_NFT_CONTRACT_ADDRESS } = require("../constants");

async function main() {
  //Deploy the FakeNFTMarketPlace contract first 
  const FakeNFTMarketPlace = await ethers.getContractFactory("FakeNFTMarketPlace");
  const fakeNftMarketPlace = await FakeNFTMarketPlace.deploy();
  await fakeNftMarketPlace.deployed();

  console.log("FakeNFTMarketPlace deployed to: ", fakeNftMarketPlace.address);

  // Now deploy the cryptoDevsDAO contract
  const CryptoDevsDAO = await ethers.getContractFactory("CryptoDevsDAO");
  const cryptoDevsDAO = await CryptoDevsDAO.deploy(fakeNftMarketPlace.address, CRYPTODEVS_NFT_CONTRACT_ADDRESS, 
    {
      value: ethers.utils.parseEther(".004"),
    });
  await cryptoDevsDAO.deployed();
  console.log("CryptoDevsDAO deployed to: ", cryptoDevsDAO.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) =>{
    console.error(error);
    process.exit(1);
  }); 