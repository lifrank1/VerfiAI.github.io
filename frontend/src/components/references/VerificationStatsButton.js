import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import axios from 'axios';
import ChatContext from '../chat/ChatContext';

const VerificationStatsButton = ({ references, user }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationStats, setVerificationStats] = useState({
    verified: 0,
    notVerified: 0,
    unverifiable: 0,
    unverifiableRefs: []
  });
  const [verificationResults, setVerificationResults] = useState([]);
  const { saveReferenceToFirestore } = useContext(ChatContext);
  
  const verifyAllReferences = useCallback(async () => {
    setIsLoading(true);
    console.log("Starting batch verification of all references");
    
    try {
      // Limit to first 3 references for testing
      const limitedReferences = references.slice(0, 3);
      console.log(`Testing with first ${limitedReferences.length} references (out of ${references.length} total)`);
      
      const results = await Promise.all(
        limitedReferences.map(async (reference, index) => {
          try {
            console.log(`Verifying reference ${index + 1}/${limitedReferences.length}`);
            const response = await axios.post('https://verifiai-3431b785f8d8.herokuapp.com//api/verify-reference', {
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

      console.log("Limited references verification complete:", results);
      setVerificationResults(results);

      // Count stats for the limited set but add placeholders for the rest
      const stats = {
        verified: 0,
        notVerified: 0,
        unverifiable: 0,
        unverifiableRefs: []
      };
      
      // Process the verified references
      results.forEach(({ status, reference }) => {
        if (status === 'verified') stats.verified++;
        else if (status === 'not_found' || status === 'failed') {
          stats.unverifiable++;
          stats.unverifiableRefs.push(reference);
        }
        else stats.notVerified++;
      });
      
      // Add note about limited verification
      stats.limitedVerification = true;
      stats.totalReferences = references.length;
      stats.verifiedCount = limitedReferences.length;

      console.log("Verification stats calculated:", stats);
      setVerificationStats(stats);
    } catch (error) {
      console.error("Error in batch verification:", error);
      setVerificationStats(prev => ({ 
        ...prev, 
        failed: true 
      }));
    } finally {
      setIsLoading(false);
    }
  }, [references]);
  
  // Reset verification state when user login state changes
  useEffect(() => {
    if (references.length > 0) {
      setIsLoading(true);
      setVerificationStats({
        verified: 0,
        notVerified: 0,
        unverifiable: 0,
        unverifiableRefs: []
      });
      setVerificationResults([]);
      verifyAllReferences();
    }
  }, [user?.userID, references, verifyAllReferences]);

  // Start verification when component mounts with simplified approach
  useEffect(() => {
    if (references.length > 0) {
      console.log(`VerificationStatsButton: Starting verification for ${references.length} references`);
      verifyAllReferences();
    }
  }, [references, verifyAllReferences]);

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
          {verificationStats.limitedVerification && (
            <p style={{ fontSize: '0.8em', color: 'orange' }}>Testing: First 3 references only</p>
          )}
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

          {isLoading ? (
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
                {verificationStats.limitedVerification && (
                  <p style={{ color: 'orange', fontStyle: 'italic' }}>
                    Testing Mode: Only verifying first {verificationStats.verifiedCount} references
                  </p>
                )}
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