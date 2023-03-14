import { Contract, providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";

import {
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
} from "../constants";
import styles from "../styles/Home.module.css";

export default function Home() {
  // Eth Balance of the DAO contract 
  const [treasuryBalance, setTreasuryBalance] = useState("0");

  //Number of proposals created in the DAO 
  const [numProposals, setNumProposals] = useState("0");

  //Array of all proposals created in the DAO 
  const [proposals, setProposals] = useState([]);

  //User's balance of CryptoDevs NFT 
  const [nftBalance, setNftBalance] = useState(0);

  //Fake NFT Token ID to purchanse, used when creating a proposal 
  const [fakeNftTokenId, setFakeNftTokenId] = useState(""); 

  // One of the create proposal or view proposal 
  const [selectedTab, setSelectedTab] = useState("");

  // True if waiting for a transaction to be minted, false otherwise 
  const [loading, setLoading] = useState(false);

  // True if the user has connected their wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);

  //isOwner gets the owner of the contract through the signed address
  const [isOwner, setIsOwner] = useState(false);

  const web3ModalRef = useRef();

  // Helper function to connect wallet 
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (error) {
      console.error(error);
    }
  }

  //gets the contract owner by connected address
  const getDAOOwner = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const contract = getDaoContractInstance(signer);

      // call the owner function from the contract 
      const _owner = await contract.owner();

      // Get the address associated to signer which is connected to Metamask 
      const address = await signer.getAddress();
      if (address.toLowerCase() === _owner.toLowerCase()) {
        setIsOwner(true);
      }
    } catch (err) {
      console.error(err.message);
    }
  }; 

  const withdrawDAOEther = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const contract = getDaoContractInstance(signer);

      const tx = await contract.withdrawEther();
      setLoading(true);
      await tx.wait();
      setLoading(false);
      getDAOTreasuryBalance()
    } catch (err) {
      console.error(err);
      window.alert(err.reason); 
    }
  }

  // Read the ETH balance of the DAO contract and set the treasuryBalance state variable 
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setTreasuryBalance(balance.toString());
    } catch (err) {
      console.error(err);
    }
  };

  // reads the num of proposals in the DAO contract and sets the numProposals state variable 
  const getNumProposalsInDAO = async () => {
    try {
      const provider = await getProviderOrSigner();
      const contract = getDaoContractInstance(provider);
      const daoNumProposals = await contract.numProposals();
      setNumProposals(daoNumProposals.toString());
    } catch (error) {
      console.error(error);
    }
  };

  const getUserNFTBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = getCryptodevsNFTContractInstance(signer);
      const balance = await nftContract.balanceOf(signer.getAddress());
      setNftBalance(parseInt(balance.toString()));
    } catch (err) {
      console.error(err);
    }
  };

  // Calls the create proposal function in the contract, using the tokenId from fakeNftTokenId 
  const createProposal = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (err) {
      console.error(err);
      window.alert(error.data.message)
    }
  };

  // Helper function to fetch and parsoe one proposal from the DAO contract
  // Given the proposal ID 
  // and converts the returned data into a javascript object with values that can be used 
  const fetchProposalById = async (id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = getDaoContractInstance(provider);
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yesVotes: proposal.yesVotes.toString(),
        noVotes: proposal.noVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (err) {
      console.error(err); 
    }
  }; 

  // Runs a loop numProposals time to fetch all proposals in the DAO and sets the proposals state variable 
  const fetchAllProposals = async () => {
    try {
      const proposals = [];
      for (let i = 0; i < numProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (err) {
      console.error(err);
    }
  }; 

  // Calls the voteOnProposal function in the contract using the proposal ID and vote params 
  const voteOnProposal = async (proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);

      let vote = _vote === "YES" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (err) {
      console.error(err);
      window.alert(err.data.message);
    }
  }; 

  // Calls the executeProtocol function in the contract using the passed proposal ID 
  const executeProposal = async (proposalId) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = getDaoContractInstance(signer);
      const txn = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
      getDAOTreasuryBalance();
    } catch (err) {
      console.error(err);
      window.alert(err.reason);
    }
  }; 

    // Helper function to fetch a Provider/Signer instance from Metamask
    const getProviderOrSigner = async (needSigner = false) => {
      const provider = await web3ModalRef.current.connect();
      const web3Provider = new providers.Web3Provider(provider);
  
      const { chainId } = await web3Provider.getNetwork();
      if (chainId !== 5) {
        window.alert("Please switch to the Goerli network!");
        throw new Error("Please switch to the Goerli network");
      }
  
      if (needSigner) {
        const signer = web3Provider.getSigner();
        return signer;
      }
      return web3Provider;
    };

    const getDaoContractInstance = (providerOrSigner) => {
      return new Contract(CRYPTODEVS_DAO_CONTRACT_ADDRESS, CRYPTODEVS_DAO_ABI, providerOrSigner);
    };

    const getCryptodevsNFTContractInstance = (providerOrSigner) => {
      return new Contract(CRYPTODEVS_NFT_CONTRACT_ADDRESS, CRYPTODEVS_NFT_ABI, providerOrSigner);
    }; 

    // Code that runs everytime teh value of walletConnected changes 
    // calls helper functionsto fetch the DAO treasury balance, user nft balance, and number of proposals in the dao 
    useEffect(() => {
      if (!walletConnected) {
        web3ModalRef.current = new Web3Modal({
          network: "goerli",
          providerOptions: {},
          disableInjectedProvider: false,
        });
  
        connectWallet().then(() => {
          getDAOTreasuryBalance();
          getUserNFTBalance();
          getNumProposalsInDAO();
          getDAOOwner();
        });
      }
    }, [walletConnected]);

  // Code that runs everytime the value of selectedTab changes
  // Used to re-fetch all proposals in the DAO when user switches to view the proposals tab 
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  function renderCreateProposalTab() {
    if (loading){
      return(
        <div className={styles.description}>
          Loading... Waiting for Transaction
        </div>
      );
    } else if (nftBalance === 0) {
        return(
          <div className={styles.description}>
            You do not own any CryptoDevs NFTs. <br />
            <b>
              You cannot create or vote on proposals
            </b>
          </div>
        );
    } else {
        return( 
          <div className={styles.container}>
            <label>Fake NFT Token ID to Purchase: </label>
            <input placeholder="0" type="number" onChange={(e) => setFakeNftTokenId(e.target.value)} />
            <button className={styles.button2} onClick={createProposal}>
              Create
            </button>
          </div>
        );
    }
  }

  // Renders the view proposals tab content 
  function renderViewProposalsTab() {
    if (loading) {
      return(
        <div className={styles.description}>
          Loading... Waiting for transaction 
        </div>
      );
    } else if (proposals.length === 0) {
      return(
        <div className={styles.description}>No proposals have been created</div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yes Votes: {p.yesVotes}</p>
              <p>No Votes: {p.noVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YES")}
                  >
                    Vote Yes
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NO")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yesVotes > p.noVotes ? "(YES)" : "(NO)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }         
  }

  return(
    <div>
      <Head>
        <title>
          CryptoDevs DAO
        </title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
        <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
        <div className={styles.description}>Welcome to the DAO!</div> 
        <div className={styles.description}>
          Your CryptoDevs NFT Balance: {nftBalance} <br />
          Treasurey Balance: {formatEther(treasuryBalance)} ETH <br />
          Total Number of Proposals: {numProposals}
        </div>
        <div className={styles.flex}>
          <button className={styles.button} onClick={() => setSelectedTab("Create Proposal")}>
            Create Proposal
          </button>
          <button className={styles.button} onClick={() => setSelectedTab("View Proporsals")}>
            View Proposals
          </button>
        </div>
          {renderTabs()}
          {/*Display additional withdraw button if connected wallet is owner */}
            {isOwner ? (
            <div>
            {loading ? <button className={styles.button}>Loading...</button>
                     : <button className={styles.button} onClick={withdrawDAOEther}>Withdraw DAO ETH</button>
            }
            </div>
            ) : ("")
          }
        </div>
        <div>
          <img className={styles.image} src="0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}