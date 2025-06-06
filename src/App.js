import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
  // State for wallet connection
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [web3Provider, setWeb3Provider] = useState(null);
  const [networkId, setNetworkId] = useState(null);
  const [balance, setBalance] = useState('0');

  // State for tranches data (can be fetched from a smart contract later)
  const [tranches, setTranches] = useState([
    {
      id: 'A',
      name: 'Tranche A',
      rewardAsset: 'AVALON',
      minimumContribution: '1 ETH',
      cap: '150,000 AVALON / 150,000 AVALON',
      status: 'active', // 'active' or 'coming_soon'
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

  // Placeholder for Firebase/Auth setup (if needed for future features)
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Check if wallet is already connected on page load
    checkWalletConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    // Cleanup listeners on unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Check if wallet is already connected
  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' 
        });
        
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setWalletConnected(true);
          await getNetworkInfo();
          await getBalance(accounts[0]);
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error);
      }
    }
  };

  // Handle account changes
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected wallet
      setWalletConnected(false);
      setUserAddress('');
      setBalance('0');
      setNetworkId(null);
    } else {
      // User switched accounts
      setUserAddress(accounts[0]);
      getBalance(accounts[0]);
    }
  };

  // Handle network changes
  const handleChainChanged = (chainId) => {
    // Reload the page when network changes for simplicity
    // In production, you might want to handle this more gracefully
    window.location.reload();
  };

  // Get network information
  const getNetworkInfo = async () => {
    try {
      const chainId = await window.ethereum.request({ 
        method: 'eth_chainId' 
      });
      setNetworkId(parseInt(chainId, 16));
    } catch (error) {
      console.error('Error getting network info:', error);
    }
  };

  // Get user's ETH balance
  const getBalance = async (address) => {
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      // Convert from wei to ETH
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
      setBalance(balanceInEth.toFixed(4));
    } catch (error) {
      console.error('Error getting balance:', error);
    }
  };

  // Get network name from chainId
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
      8453: 'Base Mainnet'
    };
    return networks[chainId] || `Unknown Network (${chainId})`;
  };

  // Function to handle wallet connection
  const handleConnectWallet = async () => {
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
      alert('MetaMask is not installed. Please install MetaMask to continue.');
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setUserAddress(accounts[0]);
        setWalletConnected(true);
        await getNetworkInfo();
        await getBalance(accounts[0]);
        
        console.log('Wallet connected successfully!');
        console.log('Account:', accounts[0]);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      
      if (error.code === 4001) {
        // User rejected the request
        alert('Please connect your wallet to continue.');
      } else {
        alert('An error occurred while connecting to your wallet. Please try again.');
      }
    }
  };

  // Function to handle contribution
  const handleContribute = async (trancheId) => {
    if (!walletConnected) {
      alert("Please connect your wallet first.");
      return;
    }

    try {
      console.log(`Contributing to Tranche ${trancheId}`);
      
      // Example transaction - you'll replace this with your smart contract interaction
      const transactionParameters = {
        to: '0x...', // Your contract address
        from: userAddress,
        value: '0x16345785D8A0000', // 0.1 ETH in hexadecimal (example)
        gas: '0x5208', // 21000 in hexadecimal
        gasPrice: '0x09184e72a000', // 10000000000 in hexadecimal
      };

      // For now, we'll just log the transaction details
      // In a real implementation, you would:
      // 1. Call your smart contract's contribute function
      // 2. Handle the transaction response
      // 3. Update the UI accordingly
      
      console.log('Transaction would be sent with:', transactionParameters);
      alert(`Contribution to Tranche ${trancheId} initiated! (This is a demo - no actual transaction sent)`);
      
      // Uncomment the following line to send an actual transaction:
      // const txHash = await window.ethereum.request({
      //   method: 'eth_sendTransaction',
      //   params: [transactionParameters],
      // });
      
    } catch (error) {
      console.error('Error contributing:', error);
      alert('An error occurred while processing your contribution. Please try again.');
    }
  };

  // Tranche Card Component
  const TrancheCard = ({ tranche, onContribute }) => (
    <div className={`
      bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-between
      transition-all duration-300 hover:shadow-xl
      ${tranche.status === 'coming_soon' ? 'opacity-70 cursor-not-allowed' : ''}
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
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
          <span className="font-medium">Cap:</span>
          <span>{tranche.cap}</span>
        </div>
      </div>
      <button
        onClick={() => onContribute(tranche.id)}
        disabled={tranche.status === 'coming_soon' || !walletConnected}
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
      {tranche.status === 'coming_soon' && (
        <span className="mt-2 text-sm text-gray-500">Stay tuned!</span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col items-center">
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
            />
          ))}
        </section>

        {/* Optional: User ID display if Firebase is enabled and user is logged in */}
        {/*
        {userId && (
          <div className="mt-12 p-4 bg-blue-100 text-blue-800 rounded-lg shadow-md text-sm">
            Your User ID: <span className="font-mono break-all">{userId}</span>
          </div>
        )}
        */}
      </main>

      {/* Footer (Optional) */}
      <footer className="w-full bg-gray-800 text-white py-6 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} AVALON DApp. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;