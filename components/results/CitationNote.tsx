export default function CitationNote() {
  return (
    <details className="sport-card p-4 text-sm">
      <summary className="font-semibold text-gray-700 cursor-pointer">
        計算根拠と参考文献
      </summary>
      <div className="mt-3 space-y-2 text-gray-600 leading-relaxed">
        <p>本ツールは、以下のスポーツ栄養学・運動生理学の研究および公的ガイドラインに基づいています。</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Mifflin MD, et al.{' '}
            <em>A new predictive equation for resting energy expenditure</em>.
            Am J Clin Nutr. 1990;51(2):241-247.
          </li>
          <li>Katch FI, McArdle WD. Exercise Physiology: Energy, Nutrition, and Human Performance.</li>
          <li>
            Jäger R, et al. ISSN Position Stand:{' '}
            <em>Protein and Exercise</em>. JISSN. 2017;14:20.
          </li>
          <li>
            Aragon AA, et al. ISSN Position Stand:{' '}
            <em>Diets and Body Composition</em>. JISSN. 2017;14:16.
          </li>
          <li>
            ACSM <em>Guidelines for Exercise Testing and Prescription</em> (11th ed., 2021).
          </li>
          <li>
            Helms ER, et al.{' '}
            <em>
              Evidence-based recommendations for natural bodybuilding contest
              preparation: nutrition and supplementation
            </em>
            . J Int Soc Sports Nutr. 2014;11:20.
          </li>
          <li>
            Schoenfeld BJ, et al.{' '}
            <em>
              Dose-response relationship between weekly resistance training
              volume and increases in muscle mass: A systematic review and
              meta-analysis
            </em>
            . J Sports Sci. 2017;35(11):1073-1082.
          </li>
          <li>
            Byrne NM, et al. (MATADOR Study){' '}
            <em>
              Intermittent energy restriction improves weight loss efficiency
            </em>
            . Int J Obes. 2018;42(2):129-138.
          </li>
          <li>
            Barakat C, et al.{' '}
            <em>
              Body Recomposition: Can Trained Individuals Build Muscle and Lose
              Fat at the Same Time?
            </em>{' '}
            Strength Cond J. 2020;42(5):7-21.
          </li>
          <li>
            Kerksick CM, et al. ISSN Position Stand:{' '}
            <em>Nutrient Timing</em>. JISSN. 2017;14:33.
          </li>
          <li>
            Aragon AA, Schoenfeld BJ.{' '}
            <em>
              Nutrient timing revisited: is there a post-exercise anabolic
              window?
            </em>{' '}
            JISSN. 2013;10:5.
          </li>
          <li>
            Schoenfeld BJ, Aragon AA.{' '}
            <em>
              How much protein can the body use in a single meal for muscle-building?
            </em>{' '}
            JISSN. 2018;15:10.
          </li>
        </ul>
        <h3 className="font-semibold text-gray-700 mt-3">マクロ配分の根拠</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>
            減量時のタンパク質：除脂肪体重あたり 2.0〜2.4 g (筋量維持を最大化、ISSN推奨)
          </li>
          <li>増量時のタンパク質：除脂肪体重あたり 1.6〜2.2 g</li>
          <li>脂質：体重あたり最低 0.8 g、または総カロリーの約 25〜30%</li>
          <li>残りを炭水化物として配分（運動パフォーマンス維持のため最低 100g 推奨）</li>
        </ul>
        <h3 className="font-semibold text-gray-700 mt-3">リーンカット時の調整</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>タンパク質を 2.4 g/kg LBM に増強（ISSN max range 寄り）</li>
          <li>減量ペースを 0.5〜0.75%/週 にクランプ（筋量維持の安全レンジ）</li>
          <li>除脂肪体重ベースの Katch-McArdle 式を採用</li>
          <li>レジスタンストレーニング週2-3回以上を推奨（Schoenfeld 2017）</li>
          <li>長期減量では 1週間の維持カロリー（refeed/diet break）を推奨（Byrne 2018）</li>
        </ul>

        <h3 className="font-semibold text-gray-700 mt-3">安全上の注意</h3>
        <p>
          週次体重変化は安全上、現体重の ±1% を上限にクランプしています。本ツールは参考情報であり、医療・栄養指導の代替ではありません。基礎疾患のある方や妊娠中の方は専門家にご相談ください。
        </p>
      </div>
    </details>
  );
}
