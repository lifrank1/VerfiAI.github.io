import React, { useState, useEffect, useContext } from 'react';
import { Pie } from 'react-chartjs-2';
import axios from 'axios';
import ChatContext from '../chat/ChatContext';

const VerificationStatsButton = ({ references, user }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [verificationStats, setVerificationStats] = useState({
    verified: 0,
    notVerified: 0,
    unverifiable: 0,
    unverifiableRefs: [],
    loading: false
  });
  const [verificationResults, setVerificationResults] = useState([]);
  const { saveReferenceToFirestore } = useContext(ChatContext);

  // Start verification when component mounts
  useEffect(() => {
    if (references.length > 0) {
      console.log(`VerificationStatsButton: Starting verification for ${references.length} references, User logged in: ${user ? 'Yes' : 'No'}`);
      verifyAllReferences();
    }
  }, [references]);

  const verifyAllReferences = async () => {
    setVerificationStats(prev => ({ ...prev, loading: true }));
    console.log("Starting batch verification of all references");
    
    try {
      const results = await Promise.all(
        references.map(async (reference, index) => {
          try {
            console.log(`Verifying reference ${index + 1}/${references.length}`);
            const response = await axios.post('http://localhost:3002/api/verify-reference', {
              reference
            });
            console.log(`Reference ${index + 1} verification result:`, response.data.verification_status);
            return {
              reference,
              status: response.data.verification_status
            };
          } catch (error) {
            console.error(`Error verifying reference ${index + 1}:`, error);
            return {
              reference,
              status: 'failed'
            };
          }
        })
      );

      console.log("All references verification complete:", results);
      setVerificationResults(results);

      const stats = results.reduce((acc, { status, reference }) => {
        if (status === 'verified') acc.verified++;
        else if (status === 'not_found' || status === 'failed') {
          acc.unverifiable++;
          acc.unverifiableRefs.push(reference);
        }
        else acc.notVerified++;
        return acc;
      }, { verified: 0, notVerified: 0, unverifiable: 0, unverifiableRefs: [] });

      console.log("Verification stats calculated:", stats);
      setVerificationStats({ ...stats, loading: false });
    } catch (error) {
      console.error("Error in batch verification:", error);
      setVerificationStats(prev => ({ 
        ...prev, 
        loading: false,
        failed: true 
      }));
    }
  };

  // Save all verified references
  const saveAllVerifiedReferences = async () => {
    // Check if user is logged in
    if (!user || !user.userID) {
      alert("Please log in to save references");
      return 0;
    }

    const verifiedRefs = references.filter((ref) => {
      const result = verificationResults.find(vr => 
        vr.reference.title === ref.title && 
        vr.reference.doi === ref.doi
      );
      return result && result.status === 'verified';
    });
    
    if (verifiedRefs.length === 0) {
      alert("No verified references to save");
      return 0;
    }
    
    console.log("Saving all verified references. Count:", verifiedRefs.length);
    console.log("User ID:", user.userID);
    
    // Save all verified references to Firestore
    let savedCount = 0;
    try {
      for (const ref of verifiedRefs) {
        const citationData = {
          title: ref.title || ref.unstructured || "Untitled Reference",
          authors: ref.authors || [],
          year: ref.year || null,
          doi: ref.doi || null,
          research_field: { field: "Reference" },
          is_retracted: false
        };
        
        if (saveReferenceToFirestore && user && user.userID) {
          await saveReferenceToFirestore(citationData, user.userID);
          savedCount++;
        }
      }
      
      // Show success message
      alert(`Successfully saved ${savedCount} citations!`);
      
      // Close the stats window after saving
      setIsOpen(false);
      
      return savedCount;
    } catch (error) {
      console.error("Error saving references:", error);
      alert(`Saved ${savedCount} references before encountering an error. Please try again.`);
      return savedCount;
    }
  };

  const chartData = {
    labels: ['Verified', 'Not Verified', 'Unverifiable'],
    datasets: [{
      data: [
        verificationStats.verified,
        verificationStats.notVerified,
        verificationStats.unverifiable
      ],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Reference Verification Status',
        color: '#333',
        font: { size: 16 }
      }
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !isOpen && setIsHovered(false)}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#6E44FF',
          color: 'white',
          border: 'none',
          padding: '0.5rem',
          borderRadius: '50%',
          width: '30px',
          height: '30px',
          cursor: 'pointer',
          marginLeft: '10px'
        }}
      >
        📊
      </button>

      {/* Hover preview */}
      {isHovered && !isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          width: '200px',
          textAlign: 'center'
        }}>
          <p>View References Status</p>
          <p>{verificationStats.verified} Verified, {verificationStats.notVerified + verificationStats.unverifiable} Unverified</p>
        </div>
      )}

      {/* Full view when clicked */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 1000,
          width: '500px',
          maxWidth: '90vw'
        }}>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>

          <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>References Verification</h3>

          {verificationStats.loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Verifying references...</p>
            </div>
          ) : (
            <>
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <Pie data={chartData} options={options} />
              </div>
              
              <div style={{ marginTop: '2rem' }}>
                <h4>Verification Summary</h4>
                <p>Total References: {references.length}</p>
                <p>Verified: {verificationStats.verified}</p>
                <p>Not Verified: {verificationStats.notVerified}</p>
                <p>Unverifiable: {verificationStats.unverifiable}</p>

                {/* Save All Verified References button */}
                {verificationStats.verified > 0 && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      onClick={saveAllVerifiedReferences}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Save All Verified References
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VerificationStatsButton; 