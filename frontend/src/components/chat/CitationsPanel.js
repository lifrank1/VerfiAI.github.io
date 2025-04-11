import React from 'react';

const CitationsPanel = ({ citations }) => {
  return (
    <div className="citations-panel">
      <h3>Your Saved Citations</h3>
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
                <div className="citation-year">{citation.year}</div>
              )}
              {citation.doi && (
                <div className="citation-doi">
                  <a
                    href={`https://doi.org/${citation.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {citation.doi}
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-citations">
          No citations saved yet. Verify references and click "Save" to add them here.
        </p>
      )}
    </div>
  );
};

export default CitationsPanel; 