import React, { useState, useEffect } from 'react';
import { Contract, BrowserProvider, parseEther, formatEther } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// *** IMPORTANT: REPLACE THESE WITH YOUR ACTUAL DEPLOYED CONTRACT ADDRESSES ***
const AVALON_TOKEN_ADDRESS = '0x3D79387CB580651d0570dcCaDed14E16DdC0EcC8';
const AVALON_SALE_CONTRACT_ADDRESS = '0x9fc7ad123d1d781c7251f8676e11690e364c10a7';

// ABI for the AvalonTokenSale contract (simplified for demonstration)
const AvalonTokenSaleABI = [
    // Functions
    "function buyTokens() payable",
    "function rate() view returns (uint256)",
    "function softCap() view returns (uint256)",
    "function hardCap() view returns (uint256)",
    "function totalEthRaised() view returns (uint256)",
    "function minContribution() view returns (uint256)",
    "function getContractEthBalance() view returns (uint256)",
    "function avalonToken() view returns (address)",
    // Events
    "event TokensPurchased(address indexed purchaser, uint256 ethAmount, uint256 tokenAmount)",
];

// ABI for a generic ERC-20 token (needed to interact with AVALON token directly)
const ERC20ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];


// Main App component
const App = () => {
  // State for wallet connection
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [web3Provider, setWeb3Provider] = useState(null);
  const [networkId, setNetworkId] = useState(null);
  const [balance, setBalance] = useState('0');
  const [userAvalonBalance, setUserAvalonBalance] = useState('0'); // New state for user's AVALON balance
  const [avalonSaleContract, setAvalonSaleContract] = useState(null);
  const [avalonTokenContract, setAvalonTokenContract] = useState(null);
  const [currentRate, setCurrentRate] = useState('0');
  const [minContractContributionEth, setMinContractContributionEth] = useState('0'); // Changed default to '0' as formatEther can produce very small numbers
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingContribution, setPendingContribution] = useState({ trancheId: '', ethAmount: '', tokenAmount: '' });

  // State for tranches data (can be fetched from a smart contract later)
  const [tranches, setTranches] = useState([
    {
      id: 'A',
      name: 'Tranche A',
      rewardAsset: 'AVALON',
      minimumContribution: '...', // Will be updated from contract
      tokensPerMinContribution: '...', // Will be updated from contract
      cap: '...', // Will be dynamic based on sale contract hardCap / total ETH collected
      status: 'active',
      buttonText: 'Contribute Now',
    },
    {
      id: 'B',
      name: 'Tranche B',
      rewardAsset: 'AVALON',
      minimumContribution: '??? ETH',
      cap: '??? AVALON / ??? AVALON',
      status: 'coming_soon',
      buttonText: 'Coming Soon',
    },
    {
      id: 'C',
      name: 'Tranche C',
      rewardAsset: 'AVALON',
      minimumContribution: '??? ETH',
      cap: '??? AVALON / ??? AVALON',
      status: 'coming_soon',
      buttonText: 'Coming Soon',
    },
  ]);
  const ConfirmModal = ({ show, onClose, onConfirm, ethAmount, tokenAmount }) => {
    if (!show) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Confirm Contribution</h2>
          <p className="text-sm text-gray-700 mb-4">
            You are about to contribute <strong>{ethAmount} ETH</strong>.
            <br />
            This will buy you approximately <strong>{tokenAmount} AVALON</strong> tokens.
          </p>
          <div className="flex justify-end gap-4">
            <button
              className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 text-gray-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onConfirm}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    checkWalletConnection();
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
    const initializeContractsAndFetchSaleDetails = async () => {
      if (web3Provider && AVALON_SALE_CONTRACT_ADDRESS && AVALON_TOKEN_ADDRESS && userAddress) {
        try {
          const signer = await web3Provider.getSigner(userAddress); 
          const saleContract = new Contract(AVALON_SALE_CONTRACT_ADDRESS, AvalonTokenSaleABI, signer);
          setAvalonSaleContract(saleContract);

          const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, web3Provider);
          setAvalonTokenContract(tokenContract);

          // Fetch sale details from contract to update Tranche A
          const rate = await saleContract.rate();
          setCurrentRate(rate.toString()); // Store the rate
          const hardCapWei = await saleContract.hardCap();
          const totalEthRaisedWei = await saleContract.totalEthRaised();
          const minContributionWei = await saleContract.minContribution();
          setMinContractContributionEth(formatEther(minContributionWei)); // Store min contribution

          const hardCapEth = formatEther(hardCapWei);
          const totalEthRaisedEth = formatEther(totalEthRaisedWei);
          const minContributionEth = formatEther(minContributionWei);
         let progress = (parseFloat(totalEthRaisedEth) / parseFloat(hardCapEth)) * 100;
        let progressPercent = progress < 0.01 && progress > 0 ? '0.01' : progress.toFixed(2);

          console.log('Total ETH Raised:', totalEthRaisedEth);

          // Assuming 'rate' from contract is AVALON_whole_tokens per 1 ETH
          const tokensPerEth = parseFloat(rate.toString());

          // Use raw parseFloat results for 'full decimals' display
          const calculatedTokensPerMinContribution = parseFloat(minContributionEth) * tokensPerEth;
          
          const remainingEthCap = parseFloat(hardCapEth) - parseFloat(totalEthRaisedEth);
          const tokensAvailableToBuy = remainingEthCap * tokensPerEth;
          const tokensHardCap = parseFloat(hardCapEth) * tokensPerEth;

          setTranches(prevTranches => prevTranches.map(tranche => {
            if (tranche.id === 'A') {
              return {
                ...tranche,
                minimumContribution: `${minContributionEth} ETH`, // Display raw formatEther result
               tokensPerMinContribution: `${calculatedTokensPerMinContribution.toFixed(2)} AVALON`,
                // Use toLocaleString for Cap for readability of large numbers
                cap: `${tokensHardCap.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AVALON / ${tokensAvailableToBuy.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AVALON`,
                status: tokensAvailableToBuy > 0 ? 'active' : 'sold_out',
                buttonText: tokensAvailableToBuy > 0 ? 'Contribute Now' : 'Sold Out',
                progressPercent,
              };
            }
            return tranche;
          }));

        } catch (error) {
          console.error("Error initializing contracts or fetching sale details:", error);
        }
      }
    };
    initializeContractsAndFetchSaleDetails();
  }, [web3Provider, walletConnected, userAddress]);

  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new BrowserProvider(window.ethereum);
        setWeb3Provider(provider);

        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setUserAddress(accounts[0].address);
          setWalletConnected(true);
          await getNetworkInfo(provider);
          await getBalance(provider, accounts[0].address);
          // Fetch AVALON balance
          if (AVALON_TOKEN_ADDRESS) {
              const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, provider);
              const avalonBalance = await tokenContract.balanceOf(accounts[0].address);
              // Assuming AVALON token also has 18 decimals for display
              setUserAvalonBalance(formatEther(avalonBalance));
          }
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length === 0) {
      setWalletConnected(false);
      setUserAddress('');
      setBalance('0');
      setUserAvalonBalance('0'); // Reset AVALON balance
      setNetworkId(null);
      setAvalonSaleContract(null);
      setAvalonTokenContract(null);
      setCurrentRate('0');
      setMinContractContributionEth('0');
    } else {
      setUserAddress(accounts[0]);
      const provider = new BrowserProvider(window.ethereum);
      setWeb3Provider(provider);
      await getBalance(provider, accounts[0]);
      // Fetch AVALON balance for new account
      if (AVALON_TOKEN_ADDRESS) {
          const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, provider);
          const avalonBalance = await tokenContract.balanceOf(accounts[0]);
          setUserAvalonBalance(formatEther(avalonBalance));
      }
    }
  };

  const handleChainChanged = (chainId) => {
    window.location.reload();
  };

  const getNetworkInfo = async (provider) => {
    try {
      const network = await provider.getNetwork();
      setNetworkId(network.chainId);
    } catch (error) {
      console.error('Error getting network info:', error);
    }
  };

  const getBalance = async (provider, address) => {
    try {
      const ethBalance = await provider.getBalance(address);
      setBalance(formatEther(ethBalance));
    } catch (error) {
      console.error('Error getting balance:', error);
    }
  };

  const getNetworkName = (chainId) => {
    const networks = {
      1: 'Ethereum Mainnet',
      3: 'Ropsten Testnet',
      4: 'Rinkeby Testnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      137: 'Polygon Mainnet',
      80001: 'Polygon Mumbai',
      56: 'Binance Smart Chain',
      97: 'BSC Testnet',
      8453: 'Base Mainnet',
      84532: 'Base Sepolia'
    };
    return networks[chainId] || `Unknown Network (${chainId})`;
  };

  const handleConnectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.info('MetaMask is not installed. Please install MetaMask to continue.');
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      setWeb3Provider(provider);

      const accounts = await provider.send("eth_requestAccounts", []);

      if (accounts.length > 0) {
        setUserAddress(accounts[0]);
        setWalletConnected(true);
        await getNetworkInfo(provider);
        await getBalance(provider, accounts[0]);
        
        const signer = await provider.getSigner(accounts[0]);
        const saleContract = new Contract(AVALON_SALE_CONTRACT_ADDRESS, AvalonTokenSaleABI, signer);
        setAvalonSaleContract(saleContract);

        const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, provider);
        setAvalonTokenContract(tokenContract);
        // Fetch AVALON balance after connecting
        const avalonBalance = await tokenContract.balanceOf(accounts[0]);
        setUserAvalonBalance(formatEther(avalonBalance));

        // Fetch and set rate and min contribution immediately after connecting
        const rate = await saleContract.rate();
        setCurrentRate(rate.toString());
        const minContWei = await saleContract.minContribution();
        setMinContractContributionEth(formatEther(minContWei));

        console.log('Wallet connected successfully!');
        console.log('Account:', accounts[0]);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      if (error.code === 4001) {
          toast.info('Please connect your wallet to continue.');
      } else if (error.info && error.info.network && error.info.network.name === "base-sepolia" && error.operation === "getEnsAddress") {
          toast.success("Wallet connection successful, but ENS resolution is not supported on Base Sepolia. This does not affect core DApp functionality.");
          console.warn("ENS resolution not supported on Base Sepolia. This is expected.");
      } else {
        toast.error('An error occurred while connecting to your wallet. Please try again.');
      }
    }
  };

  const handleContribute = async (trancheId, amountEth) => {
    if (!walletConnected || !avalonSaleContract) {
      toast.info("Please connect your wallet first.");
      return;
    }

    const contributionAmountEth = amountEth || minContractContributionEth; // Use fetched min contribution
    let calculatedTokensToBuy = "0";

    try {
        const currentSaleRate = currentRate !== '0' ? parseFloat(currentRate) : parseFloat(formatEther(await avalonSaleContract.rate()));
        calculatedTokensToBuy = (parseFloat(contributionAmountEth) * currentSaleRate); // Raw calculation
    } catch (error) {
        console.error("Could not fetch rate from contract for calculation:", error);
    }
    
    // Confirmation before sending transaction
    setPendingContribution({
  trancheId,
  ethAmount: contributionAmountEth,
  tokenAmount: calculatedTokensToBuy.toFixed(2),
});
setShowConfirmModal(true);



    const contributionAmountWei = parseEther(contributionAmountEth);

    try {
        console.log(`Initiating contribution to Tranche ${trancheId} with ${contributionAmountEth} ETH`);
        
        const tx = await avalonSaleContract.buyTokens({
            value: contributionAmountWei
        });

        toast.info(`Transaction sent! Waiting for confirmation: ${tx.hash}`);
        console.log('Transaction hash:', tx.hash);

        await tx.wait();
        toast.success(`Contribution to Tranche ${trancheId} successful! Transaction confirmed.`);
        console.log('Transaction confirmed:', tx);

        if (web3Provider && userAddress) {
            await getBalance(web3Provider, userAddress);
            // Fetch AVALON balance after successful contribution
            if (AVALON_TOKEN_ADDRESS) {
                const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, web3Provider);
                const avalonBalance = await tokenContract.balanceOf(userAddress);
                setUserAvalonBalance(formatEther(avalonBalance));
            }

            // Re-fetch sale details to update the cap display and token values
            const rate = await avalonSaleContract.rate();
            setCurrentRate(rate.toString()); // Update stored rate
            const hardCapWei = await avalonSaleContract.hardCap();
            const totalEthRaisedWei = await avalonSaleContract.totalEthRaised();
            const minContributionWei = await avalonSaleContract.minContribution();

            const hardCapEth = formatEther(hardCapWei);
            const totalEthRaisedEth = formatEther(totalEthRaisedWei);
            const minContributionEth = formatEther(minContributionWei);
            setMinContractContributionEth(minContributionEth);

            const tokensPerEth = parseFloat(rate.toString());
            const calculatedTokensAvailableToBuy = (parseFloat(hardCapEth) - parseFloat(totalEthRaisedEth)) * tokensPerEth;
            const calculatedTokensHardCap = parseFloat(hardCapEth) * tokensPerEth;
            const calculatedTokensPerMinContribution = parseFloat(minContributionEth) * tokensPerEth;


            setTranches(prevTranches => prevTranches.map(tranche => {
                if (tranche.id === 'A') {
                    return {
                        ...tranche,
                        minimumContribution: `${minContributionEth} ETH`,
                        tokensPerMinContribution: `${calculatedTokensPerMinContribution.toFixed(2)} AVALON`,
                        cap: `${calculatedTokensHardCap.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AVALON / ${calculatedTokensAvailableToBuy.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AVALON`,
                        status: calculatedTokensAvailableToBuy > 0 ? 'active' : 'sold_out',
                        buttonText: calculatedTokensAvailableToBuy > 0 ? 'Contribute Now' : 'Sold Out',
                    };
                }
                return tranche;
            }));
        }

    } catch (error) {
      console.error('Error contributing:', error);
      let errorMessage = 'An error occurred while processing your contribution. Please try again.';
      if (error.code === 4001) {
          errorMessage = 'Transaction rejected by user.';
      } else if (error.data && error.data.message) {
          errorMessage = `Transaction failed: ${error.data.message}`;
      } else if (error.message) {
          errorMessage = `Transaction failed: ${error.message}`;
      }
      toast.error(errorMessage);
    }
  };
  const confirmAndSendTransaction = async () => {
  const { trancheId, ethAmount } = pendingContribution;
  const contributionAmountWei = parseEther(ethAmount);

  try {
    const tx = await avalonSaleContract.buyTokens({ value: contributionAmountWei });
    toast.info(`Transaction sent! Waiting for confirmation: ${tx.hash}`);
    await tx.wait();
    toast.success(`Contribution to Tranche ${trancheId} successful!`);

    // REFRESH DATA (you already have this logic in handleContribute)
    if (web3Provider && userAddress) {
      await getBalance(web3Provider, userAddress);
      const tokenContract = new Contract(AVALON_TOKEN_ADDRESS, ERC20ABI, web3Provider);
      const avalonBalance = await tokenContract.balanceOf(userAddress);
      setUserAvalonBalance(formatEther(avalonBalance));

      const rate = await avalonSaleContract.rate();
      setCurrentRate(rate.toString());
      const hardCapWei = await avalonSaleContract.hardCap();
      const totalEthRaisedWei = await avalonSaleContract.totalEthRaised();
      const minContributionWei = await avalonSaleContract.minContribution();

      const hardCapEth = formatEther(hardCapWei);
      const totalEthRaisedEth = formatEther(totalEthRaisedWei);
      const minContributionEth = formatEther(minContributionWei);
      setMinContractContributionEth(minContributionEth);

      const tokensPerEth = parseFloat(rate.toString());
      const calculatedTokensAvailableToBuy = (parseFloat(hardCapEth) - parseFloat(totalEthRaisedEth)) * tokensPerEth;
      const calculatedTokensHardCap = parseFloat(hardCapEth) * tokensPerEth;
      const calculatedTokensPerMinContribution = parseFloat(minContributionEth) * tokensPerEth;

      let progress = (parseFloat(totalEthRaisedEth) / parseFloat(hardCapEth)) * 100;
      let progressPercent = progress.toFixed(2);
      if (progress > 0 && progressPercent === '0.00') progressPercent = '0.01';

      setTranches(prevTranches => prevTranches.map(tranche => {
        if (tranche.id === 'A') {
          return {
            ...tranche,
            minimumContribution: `${minContributionEth} ETH`,
            tokensPerMinContribution: `${calculatedTokensPerMinContribution.toFixed(2)} AVALON`,
            cap: `${calculatedTokensHardCap.toLocaleString()} AVALON / ${calculatedTokensAvailableToBuy.toLocaleString()} AVALON`,
            status: calculatedTokensAvailableToBuy > 0 ? 'active' : 'sold_out',
            buttonText: calculatedTokensAvailableToBuy > 0 ? 'Contribute Now' : 'Sold Out',
            progressPercent,
          };
        }
        return tranche;
      }));
    }
  } catch (error) {
    let errorMessage = 'An error occurred while processing your contribution.';
    if (error.code === 4001) errorMessage = 'Transaction rejected by user.';
    else if (error.data?.message) errorMessage = error.data.message;
    else if (error.message) errorMessage = error.message;
    toast.error(errorMessage);
  } finally {
    setShowConfirmModal(false);
  }
};

const TrancheCard = ({ tranche, onContribute, walletConnected }) => {
  const [customContribution, setCustomContribution] = useState('');

  return (
    <div className={`
      bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-between
      transition-all duration-300 hover:shadow-xl
      ${tranche.status === 'coming_soon' || tranche.status === 'sold_out' ? 'opacity-70 cursor-not-allowed' : ''}
    `}>
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">{tranche.name}</h3>

      <div className="text-center mb-6">
        <p className="text-gray-600">Reward Asset:</p>
        <p className="text-blue-600 font-bold text-xl">{tranche.rewardAsset}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 text-gray-700 text-sm w-full">
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
          <span className="font-medium">Min. Contribution:</span>
          <span>{tranche.minimumContribution}</span>
        </div>

        {tranche.tokensPerMinContribution && (
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
            <span className="font-medium">Tokens per Min. Contribution:</span>
            <span>{tranche.tokensPerMinContribution}</span>
          </div>
        )}

        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
          <span className="font-medium">Cap:</span>
          <span>{tranche.cap}</span>
        </div>

        {tranche.progressPercent && (
          <div className="w-full mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{tranche.progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${tranche.progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {tranche.status === 'active' && (
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Enter ETH to contribute"
            value={customContribution}
            onChange={(e) => setCustomContribution(e.target.value)}
            className="mt-4 w-full p-2 border border-gray-300 rounded-md"
          />
        )}
      </div>

      <button
        onClick={() => onContribute(tranche.id, customContribution)}
        disabled={tranche.status !== 'active' || !walletConnected}
        className={`
          mt-8 w-full py-3 px-6 rounded-lg font-semibold text-white
          transition-all duration-300
          ${tranche.status === 'active' && walletConnected
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75'
            : 'bg-gray-400 cursor-not-allowed shadow-sm'
          }
        `}
      >
        {tranche.buttonText}
      </button>

      {(tranche.status === 'coming_soon' || tranche.status === 'sold_out') && (
        <span className="mt-2 text-sm text-gray-500">
          {tranche.status === 'coming_soon' ? 'Stay tuned!' : 'Sale finished!'}
        </span>
      )}
    </div>
  );
};



  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col items-center">
          <ToastContainer position="top-right" autoClose={5000} />

      {/* Header */}
      <header className="w-full bg-white shadow-sm py-4 px-6 md:px-12 flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-blue-700">AVALON DApp</h1>
        <div className="flex items-center space-x-4">
          {walletConnected && (
            <div className="text-sm text-gray-600">
              <div className="text-right">
                <p className="font-mono text-xs">
                  {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                </p>
                <p className="text-xs">{balance} ETH</p>
                <p className="text-xs">{parseFloat(userAvalonBalance).toFixed(4)} AVALON</p> {/* Display AVALON balance */}
                {networkId && (
                  <p className="text-xs text-blue-600">
                    {getNetworkName(networkId)}
                  </p>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleConnectWallet}
            className={`
              py-2 px-6 rounded-full font-medium text-white
              transition-all duration-300
              ${walletConnected
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75
            `}
          >
            {walletConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow container mx-auto p-6 md:p-10 flex flex-col items-center justify-center">
        <section className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Participate in the AVALON Token Sale
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Secure your stake in AVALON tokens through our tiered tranches.
            Choose the tranche that best suits your contribution goals.
          </p>
        </section>

        {/* Tranches Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
          {tranches.map((tranche) => (
            <TrancheCard
              key={tranche.id}
              tranche={tranche}
              onContribute={handleContribute}
              walletConnected={walletConnected}
            />
          ))}
        </section>

      </main>

      {/* Footer (Optional) */}
      <footer className="w-full bg-gray-800 text-white py-6 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} AVALON DApp. All rights reserved.</p>
      </footer>
      <ConfirmModal
  show={showConfirmModal}
  onClose={() => setShowConfirmModal(false)}
  onConfirm={confirmAndSendTransaction}
  ethAmount={pendingContribution.ethAmount}
  tokenAmount={pendingContribution.tokenAmount}
/>

    </div>
  );
};

export default App;