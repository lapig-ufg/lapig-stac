import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Intro } from "./scenes/Intro";
import { FeatureScene } from "./scenes/FeatureScene";
import { Outro } from "./scenes/Outro";
import { COLORS } from "./colors";

const TRANSITION_DURATION = 20;

export const LapigStacVideo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* 1. Intro — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <Intro />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
      />

      {/* 2. Catálogo — Explorar Dados — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <FeatureScene
          title="Explorar Dados"
          description="Navegue pelo catálogo de dados geoespaciais de pastagem do Brasil, organizados em coleções STAC padronizadas."
          imageName="catalog.png"
          featureItems={[
            "Coleções de Área e Vigor de Pastagem",
            "Metadados padronizados STAC v1.1.0",
            "Séries temporais de 1985 a 2024",
            "Dados do MapBiomas Coleção 10",
          ]}
          accentColor={COLORS.green}
          imagePosition="right"
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
      />

      {/* 3. Coleção — Itens — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <FeatureScene
          title="Coleções Detalhadas"
          description="Visualize cada coleção com seus itens anuais, thumbnails estilizados e mapa de cobertura interativo."
          imageName="collection.png"
          featureItems={[
            "40 itens de Área de Pastagem (1985–2024)",
            "25 itens de Vigor de Pastagem (2000–2024)",
            "Thumbnails com classificação temática",
            "Mapa interativo com OpenLayers",
          ]}
          accentColor={COLORS.teal}
          imagePosition="left"
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
      />

      {/* 4. Busca — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <FeatureScene
          title="Busca Espacial"
          description="Filtre dados por região geográfica, período temporal e coleção, com visualização no mapa em tempo real."
          imageName="search.png"
          featureItems={[
            "Filtro por bounding box no mapa",
            "Seleção de intervalo temporal",
            "Busca por coleção ou texto livre",
            "API STAC compatível (POST /search)",
          ]}
          accentColor={COLORS.green}
          imagePosition="right"
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
      />

      {/* 5. Detalhe do Item — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <FeatureScene
          title="Detalhe do Item"
          description="Acesse metadados completos, visualize o raster no mapa com renderização WebGL e baixe os assets diretamente."
          imageName="item-detail.png"
          featureItems={[
            "COGs otimizados (DEFLATE, 256×256 tiles)",
            "Metadados: projeção, bandas, checksum",
            "Estilos SLD (OGC) e QML (QGIS)",
            "Download direto dos assets",
          ]}
          accentColor={COLORS.teal}
          imagePosition="left"
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
      />

      {/* 6. Outro — 4s */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
