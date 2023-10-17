import { Box, Container, Divider, Flex, Spacer } from "@chakra-ui/react"

import Footer from "./Footer"
import Header from "./Header"
import Mission from "./Mission"
import NavigationMenu from "./NavigationMenu"

/**
 * @description Layout components.
 * @param {JSX.Element} children
 * @param {boolean} widget
 * @param {boolean} footer
 * @param {boolean} displayNavigationMenu
 * @return {JSX.Element}
 */
export default function Layout({ header = true, children, widget = false, footer = true, rdva = false, displayNavigationMenu = true }) {
  return (
    <Container maxW="full" p="0">
      <Flex direction="column" h="100vh">
        {!widget && (
          <>
            {header && <Header />}
            {displayNavigationMenu && <NavigationMenu rdva={rdva} />}
          </>
        )}
        <Container maxW="container.xl" flexGrow="1">
          {children}
        </Container>
        {!widget && footer && (
          <>
            <Box>
              <Spacer />
              <Mission />
              <Divider />
              <Footer />
            </Box>
          </>
        )}
      </Flex>
    </Container>
  )
}
