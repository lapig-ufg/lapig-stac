<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld
    http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>pasture-vigor</Name>
    <UserStyle>
      <Title>MapBiomas Col. 10 — Vigor de Pastagem</Title>
      <Abstract>Classificação de vigor da pastagem. 1 = baixo, 2 = médio, 3 = alto.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Name>vigor</Name>
          <Title>Vigor de Pastagem</Title>
          <RasterSymbolizer>
            <ChannelSelection>
              <GrayChannel>
                <SourceChannelName>1</SourceChannelName>
              </GrayChannel>
            </ChannelSelection>
            <ColorMap type="values">
              <ColorMapEntry color="#00000000" quantity="0" label="Sem dados" opacity="0"/>
              <ColorMapEntry color="#D32F2F" quantity="1" label="Baixo vigor" opacity="1"/>
              <ColorMapEntry color="#FFB300" quantity="2" label="Médio vigor" opacity="1"/>
              <ColorMapEntry color="#388E3C" quantity="3" label="Alto vigor" opacity="1"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
