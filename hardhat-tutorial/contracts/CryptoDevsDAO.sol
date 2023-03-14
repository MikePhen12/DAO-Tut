// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

// we will add the interfaces here

//interface for the FakeNFTMarketPlace
interface IFakeNFTMarketPlace {
    /// getprice() returns the price of an NFT from teh fakeNFTMarketplace 
    /// returns the price in wei for an NFT 
    function getPrice() external view returns (uint256);

    // available() returns whether or not given _tokenId has already been purchased 
    function available(uint256 _tokenId) external view returns (bool);

    /// purchase() purchases an NFT from the FakeNFTMarketPlace 
    /// _tokenid is the fake NFT tokenId to purchase
    function purchase(uint256 _tokenId) external payable;
}

//Minimal interface for CryptoDevsNFT containing only two functions that we are interested in 
interface ICryptoDevsNFT {
    function balanceOf(address owner) external view returns (uint256);

    function tokenOfOwnerByIndex(address ownder, uint256 index) external view returns (uint256);

}

contract CryptoDevsDAO is Ownable {
    // Create a struct named Proposal containing all relevant information 
    struct Proposal {
        //nftTokenId - the tokenId of the NFT to pruchase from the FakeNFTMarketPlace if the proposal passes
        uint256 nftTokenId; 

        //deadline - the UNIX timestape which this proposal is active until. Proposal can be executed after the deadline has been exceeded. 
        uint256 deadline;

        //yesVotes - number of yes votes for the proposal 
        uint256 yesVotes;

        //noVotes - number of no votes for the proposal 
        uint256 noVotes;

        //executed - whether or not this proposal has been executed yet. Cannot be executed before the deadline has been exceeded. 
        bool executed;

        //voters - a mapping of CryptoDevsNFT tokenIds to booleans indicated whether that NFT has already been used to cast a vote or not 
        mapping(uint256 => bool) voters;
    }

    // Create a mapping of ID to Proposal
    mapping(uint256 => Proposal) public proposals;
    // Number of proposals that have been created
    uint256 public numProposals;

    IFakeNFTMarketPlace nftMarketPlace;
    ICryptoDevsNFT cryptoDevsNFT;
    // this initializes the contract instances for FakeNFTMarketPlace and CryptoDevsNFT
    // Payable allows this constructor to accept an eth deposit when it is being deployed
    constructor(address _nftMarketPlace, address _cryptoDevsNFT) payable {
        nftMarketPlace = IFakeNFTMarketPlace(_nftMarketPlace);
        cryptoDevsNFT = ICryptoDevsNFT(_cryptoDevsNFT);
    }

    // Create a modifier which only allows a function to be called by someone who onwns atleast 1 CryptoDevsNFT 
    modifier nftHolderOnly() {
        require(cryptoDevsNFT.balanceOf(msg.sender) > 0, "Not a DAO Member");
        _;
    }

    /// @dev createProposal allows a CryptoDevsNFT holder to create a new proposal in the DAO
    /// @param _nftTokenId - the tokenID of the NFT to be purchased from FakeNFTMarketplace if this proposal passes
    /// @return Returns the proposal index for the newly created proposal
    function createProposal(uint256 _nftTokenId) external nftHolderOnly returns (uint256) {
        require(nftMarketPlace.available(_nftTokenId), "NFT not for sale");
        Proposal storage proposal = proposals[numProposals];
        proposal.nftTokenId = _nftTokenId;

        // Set the proposal's voting deadline to be (current + 5 minutes)
        proposal.deadline = block.timestamp + 5 minutes;

        numProposals++;
        return numProposals - 1; 
    }

    // Create a modifier which only allows a function to be 
    // called if the given proposal's deadline has not been exceeded yet 

    modifier activeProposalOnly(uint256 proposalIndex) {
        require(proposals[proposalIndex].deadline > block.timestamp, "Deadline exceeded");
        _;
    }

    enum Vote {
        YES,  // 0 
        NO    // 1  
    }

    function voteOnProposal(uint256 proposalIndex, Vote vote) external nftHolderOnly activeProposalOnly(proposalIndex) {
        Proposal storage proposal = proposals[proposalIndex];
        uint256 voterNFTBalance = cryptoDevsNFT.balanceOf(msg.sender);
        uint256 numVotes = 0;

        //Calculate how many NFTs are owned by the voter that haven't already been used for voting on this proposal 
        for (uint256 i = 0; i < voterNFTBalance; i++) {
            uint256 tokenId = cryptoDevsNFT.tokenOfOwnerByIndex(msg.sender, i);
            if (proposal.voters[tokenId] == false) {
                numVotes++;
                proposal.voters[tokenId] = true;
            }
        }

        require(numVotes > 0, "Already voted");
        if (vote == Vote.YES) {
            proposal.yesVotes += numVotes;
        } else {
            proposal.noVotes += numVotes; 
        }

    }
    
    // Create a modifier which only allows a function to be called if the given proposal deadline has been exceeded
    // and if the proposal has not yet been executed 

    modifier inactiveProposalOnly(uint256 proposalIndex) {
        require(proposals[proposalIndex].deadline <= block.timestamp, "Deadline not exceeded");
        require(proposals[proposalIndex].executed == false, "Proposal already executed");
        _; 
    }

    function executeProposal(uint256 proposalIndex) external nftHolderOnly inactiveProposalOnly(proposalIndex) {
        Proposal storage proposal = proposals[proposalIndex];

        // If there are more YES votes than NO votes, purchs the NFT from the marketplace 
        if (proposal.yesVotes > proposal.noVotes) {
            uint256 nftPrice = nftMarketPlace.getPrice();
            require(address(this).balance >= nftPrice, "Not enough Funds");
            nftMarketPlace.purchase{value: nftPrice}(proposal.nftTokenId);
        }
        proposal.executed = true;
    }

    // withdrawEther allows the contract ownder to withdraw ETH from the contract
    function withdrawEther () external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Following functions allow the contract to accept ETH deposits 
    // directly from a wallet without calling a function 
    receive() external payable {}

    fallback() external payable {}


}

