export default function CitationNote() {
  return (
    <details className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
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
        <h3 className="font-semibold text-gray-700 mt-3">安全上の注意</h3>
        <p>
          週次体重変化は安全上、現体重の ±1% を上限にクランプしています。本ツールは参考情報であり、医療・栄養指導の代替ではありません。基礎疾患のある方や妊娠中の方は専門家にご相談ください。
        </p>
      </div>
    </details>
  );
}
