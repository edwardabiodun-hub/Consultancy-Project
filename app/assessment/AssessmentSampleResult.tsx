export function AssessmentSampleResult(): React.ReactElement {
  return (
    <section
      className="assessment-sample"
      aria-label="Illustrative example assessment result"
    >
      <header className="assessment-sample-header">
        <p className="assessment-sample-label">Illustrative example</p>
        <h2>See what a completed assessment can reveal.</h2>
        <p>
          This sample connects observable operating conditions to a practical
          result and a focused 90-day response.
        </p>
      </header>

      <div className="assessment-sample-summary">
        <section className="assessment-sample-profile" aria-labelledby="sample-profile-heading">
          <h3 id="sample-profile-heading">Example business profile</h3>
          <ul>
            <li>42 employees</li>
            <li>6 managers</li>
            <li>Most operating exceptions require owner approval</li>
            <li>Monthly KPI reporting requires manual reconciliation</li>
            <li>Several recurring workflows are not documented</li>
          </ul>
        </section>

        <section className="assessment-sample-score" aria-labelledby="sample-score-heading">
          <h3 id="sample-score-heading">Business Independence Score</h3>
          <p className="assessment-sample-score-value">
            <strong>58</strong>
            <span>/100</span>
          </p>
          <dl>
            <div>
              <dt>Result category</dt>
              <dd>Developing</dd>
            </div>
            <div>
              <dt>Assessment confidence</dt>
              <dd>Medium</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="assessment-sample-section" aria-labelledby="sample-components-heading">
        <h3 id="sample-components-heading">Score components</h3>
        <dl className="assessment-sample-components">
          <div>
            <dt>Owner Dependency</dt>
            <dd>
              <span>44/100</span>
              <span className="assessment-sample-bar" aria-hidden="true">
                <span style={{ width: "44%" }} />
              </span>
            </dd>
          </div>
          <div>
            <dt>Operating-System Maturity</dt>
            <dd>
              <span>61/100</span>
              <span className="assessment-sample-bar" aria-hidden="true">
                <span style={{ width: "61%" }} />
              </span>
            </dd>
          </div>
          <div>
            <dt>Information Visibility</dt>
            <dd>
              <span>69/100</span>
              <span className="assessment-sample-bar" aria-hidden="true">
                <span style={{ width: "69%" }} />
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="assessment-sample-support">
        <section className="assessment-sample-section" aria-labelledby="sample-risks-heading">
          <h3 id="sample-risks-heading">Risks</h3>
          <ul className="assessment-sample-risk-list">
            <li>Owner bottleneck</li>
            <li>Manual reporting burden</li>
            <li>Undocumented workflows</li>
          </ul>
        </section>

        <section className="assessment-sample-section" aria-labelledby="sample-capacity-heading">
          <h3 id="sample-capacity-heading">Directional capacity</h3>
          <dl className="assessment-sample-capacity">
            <div>
              <dt>Owner capacity</dt>
              <dd>12 to 18 hours per month</dd>
            </div>
            <div>
              <dt>Team capacity</dt>
              <dd>30 to 45 hours per month</dd>
            </div>
            <div>
              <dt>Annual capacity value</dt>
              <dd>$36,000 to $58,000</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="assessment-sample-disclaimer">
        This example is directional and illustrative. It is not an audit,
        valuation, financial opinion, benchmark, or promise.
      </p>

      <section className="assessment-sample-priorities" aria-labelledby="sample-priorities-heading">
        <h3 id="sample-priorities-heading">90-day priorities</h3>
        <ol>
          <li>Define decision rights for recurring operating exceptions.</li>
          <li>Standardize the monthly KPI reporting process.</li>
          <li>
            Document the two workflows that depend most heavily on owner
            knowledge.
          </li>
        </ol>
      </section>
    </section>
  );
}
