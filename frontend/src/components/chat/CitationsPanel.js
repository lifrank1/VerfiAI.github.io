import React from 'react';

const CitationsPanel = ({ citations }) => {
  return (
    <div className="citations-panel">
      <h3>Your Saved Citations</h3>
      
      <div className="citations-content" style={{ overflowY: 'auto', flex: 1, padding: '0 15px' }}>
        {citations.length > 0 ? (
          <ul className="citations-list">
            {citations.map((citation) => (
              <li key={citation.id} className="citation-item">
                <div className="citation-title">{citation.title}</div>
                {citation.authors && (
                  <div className="citation-authors">
                    {Array.isArray(citation.authors)
                      ? citation.authors.join(", ")
                      : citation.authors}
                  </div>
                )}
                {citation.year && (
                  <div className="citation-year">Year: {citation.year}</div>
                )}
                {citation.doi && (
                  <div className="citation-doi">
                    <a
                      href={`https://doi.org/${citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View DOI
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-citations">
            No citations saved yet. Verify references and click "Save" to add them here.
          </div>
        )}
      </div>
    </div>
  );
};

export default CitationsPanel; 